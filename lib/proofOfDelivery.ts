/**
 * 📸 PROOF OF DELIVERY SYSTEM - Sistema de Comprovação de Entrega
 * Captura e armazena evidências de entregas realizadas
 */

export interface DeliveryProof {
  id: string;
  stopId: number;
  address: string;
  timestamp: number;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  photo?: {
    dataUrl: string;
    size: number;
    compressed: boolean;
  };
  signature?: {
    dataUrl: string;
    recipientName: string;
  };
  notes?: string;
  deliveryType: 'successful' | 'attempted' | 'refused' | 'not_found';
  metadata: {
    userAgent: string;
    deviceInfo: string;
    appVersion: string;
  };
}

export interface CameraOptions {
  quality: number; // 0.1 to 1.0
  maxWidth: number;
  maxHeight: number;
  facingMode: 'user' | 'environment';
}

class ProofOfDeliverySystem {
  private readonly STORAGE_KEY = 'rota-facil-proofs';
  private readonly MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB
  private readonly COMPRESSION_QUALITY = 0.8;

  /**
   * 📸 Capturar comprovação de entrega
   */
  async captureProof(
    stopId: number,
    address: string,
    deliveryType: DeliveryProof['deliveryType'] = 'successful',
    options?: {
      includePhoto?: boolean;
      includeSignature?: boolean;
      notes?: string;
    }
  ): Promise<DeliveryProof> {
    const proof: DeliveryProof = {
      id: `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stopId,
      address,
      timestamp: Date.now(),
      location: await this.getCurrentLocation(),
      deliveryType,
      notes: options?.notes,
      metadata: {
        userAgent: navigator.userAgent,
        deviceInfo: this.getDeviceInfo(),
        appVersion: '1.0.0'
      }
    };

    // Capturar foto se solicitado
    if (options?.includePhoto) {
      try {
        proof.photo = await this.capturePhoto();
      } catch (error) {
        console.error('Erro ao capturar foto:', error);
        throw new Error('Falha ao capturar foto de comprovação');
      }
    }

    // Capturar assinatura se solicitado
    if (options?.includeSignature) {
      try {
        proof.signature = await this.captureSignature();
      } catch (error) {
        console.error('Erro ao capturar assinatura:', error);
        // Assinatura é opcional, não falhar por isso
      }
    }

    // Salvar comprovação
    await this.saveProof(proof);

    console.log('📸 Comprovação de entrega capturada:', proof.id);
    return proof;
  }

  /**
   * 📍 Obter localização atual
   */
  private async getCurrentLocation(): Promise<DeliveryProof['location']> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.error('Erro de geolocalização:', error);
          // Fallback para localização aproximada
          resolve({
            lat: 0,
            lng: 0,
            accuracy: -1
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }

  /**
   * 📷 Capturar foto
   */
  private async capturePhoto(): Promise<DeliveryProof['photo']> {
    return new Promise((resolve, reject) => {
      // Criar input de arquivo temporário
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment'; // Usar câmera traseira

      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('Nenhuma foto selecionada'));
          return;
        }

        try {
          const compressedPhoto = await this.compressImage(file);
          resolve(compressedPhoto);
        } catch (error) {
          reject(error);
        }
      };

      input.onerror = () => {
        reject(new Error('Erro ao acessar câmera'));
      };

      // Trigger file picker
      input.click();
    });
  }

  /**
   * 🖊️ Capturar assinatura
   */
  private async captureSignature(): Promise<DeliveryProof['signature']> {
    return new Promise((resolve, reject) => {
      // Criar modal de assinatura
      const modal = this.createSignatureModal();
      document.body.appendChild(modal);

      const canvas = modal.querySelector('canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const nameInput = modal.querySelector('input[type="text"]') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.confirm-btn') as HTMLButtonElement;
      const cancelBtn = modal.querySelector('.cancel-btn') as HTMLButtonElement;

      // Configurar canvas
      canvas.width = 400;
      canvas.height = 200;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      let isDrawing = false;
      let hasSignature = false;

      // Event listeners para desenho
      const startDrawing = (e: MouseEvent | TouchEvent) => {
        isDrawing = true;
        hasSignature = true;
        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
      };

      const stopDrawing = () => {
        isDrawing = false;
      };

      canvas.addEventListener('mousedown', startDrawing);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', stopDrawing);
      canvas.addEventListener('touchstart', startDrawing);
      canvas.addEventListener('touchmove', draw);
      canvas.addEventListener('touchend', stopDrawing);

      // Botões
      confirmBtn.onclick = () => {
        if (!hasSignature || !nameInput.value.trim()) {
          alert('Por favor, adicione uma assinatura e o nome do destinatário');
          return;
        }

        const dataUrl = canvas.toDataURL('image/png');
        document.body.removeChild(modal);
        resolve({
          dataUrl,
          recipientName: nameInput.value.trim()
        });
      };

      cancelBtn.onclick = () => {
        document.body.removeChild(modal);
        reject(new Error('Assinatura cancelada'));
      };
    });
  }

  /**
   * 🗂️ Criar modal de assinatura
   */
  private createSignatureModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <h2 class="text-2xl font-bold">✍️ Assinatura do Destinatário</h2>
          <p class="text-blue-100">Solicite a assinatura para confirmar a entrega</p>
        </div>
        
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Nome do destinatário:
            </label>
            <input 
              type="text" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Digite o nome completo"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Assinatura:
            </label>
            <canvas 
              class="w-full border-2 border-gray-300 rounded-lg cursor-crosshair bg-gray-50"
              style="touch-action: none;"
            ></canvas>
            <p class="text-xs text-gray-500 mt-1">
              Desenhe a assinatura na área acima
            </p>
          </div>
        </div>
        
        <div class="border-t border-gray-200 p-4 flex gap-2">
          <button class="cancel-btn btn-secondary flex-1">Cancelar</button>
          <button class="confirm-btn btn-primary flex-1">Confirmar</button>
        </div>
      </div>
    `;
    return modal;
  }

  /**
   * 🗜️ Comprimir imagem
   */
  private async compressImage(file: File): Promise<DeliveryProof['photo']> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // Calcular dimensões mantendo proporção
        const maxWidth = 1024;
        const maxHeight = 1024;
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Desenhar imagem redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Converter para base64 com compressão
        const dataUrl = canvas.toDataURL('image/jpeg', this.COMPRESSION_QUALITY);
        const size = Math.round((dataUrl.length * 3) / 4); // Aproximar tamanho em bytes

        if (size > this.MAX_PHOTO_SIZE) {
          reject(new Error('Foto muito grande mesmo após compressão'));
          return;
        }

        resolve({
          dataUrl,
          size,
          compressed: true
        });
      };

      img.onerror = () => {
        reject(new Error('Erro ao processar imagem'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 💾 Salvar comprovação
   */
  private async saveProof(proof: DeliveryProof): Promise<void> {
    try {
      const existingProofs = this.getAllProofs();
      existingProofs.push(proof);

      // Manter apenas últimas 100 comprovações
      if (existingProofs.length > 100) {
        existingProofs.splice(0, existingProofs.length - 100);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingProofs));
    } catch (error) {
      console.error('Erro ao salvar comprovação:', error);
      throw new Error('Falha ao salvar comprovação');
    }
  }

  /**
   * 📋 Obter todas as comprovações
   */
  getAllProofs(): DeliveryProof[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erro ao carregar comprovações:', error);
      return [];
    }
  }

  /**
   * 🔍 Obter comprovação por ID
   */
  getProofById(id: string): DeliveryProof | null {
    const proofs = this.getAllProofs();
    return proofs.find(proof => proof.id === id) || null;
  }

  /**
   * 📊 Obter comprovações por parada
   */
  getProofsByStop(stopId: number): DeliveryProof[] {
    const proofs = this.getAllProofs();
    return proofs.filter(proof => proof.stopId === stopId);
  }

  /**
   * 📱 Obter informações do dispositivo
   */
  private getDeviceInfo(): string {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Mac/i.test(ua)) return 'macOS';
    return 'Unknown';
  }

  /**
   * 📤 Exportar comprovações
   */
  exportProofs(): string {
    const proofs = this.getAllProofs();
    return JSON.stringify(proofs, null, 2);
  }

  /**
   * 🗑️ Limpar comprovações antigas
   */
  cleanupOldProofs(daysOld: number = 30): void {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const proofs = this.getAllProofs();
    const recentProofs = proofs.filter(proof => proof.timestamp > cutoff);
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentProofs));
    console.log(`🗑️ Removidas ${proofs.length - recentProofs.length} comprovações antigas`);
  }
}

// Instância singleton
export const proofOfDelivery = new ProofOfDeliverySystem();

// Cleanup automático na inicialização
if (typeof window !== 'undefined') {
  // Executar limpeza apenas uma vez por dia
  const lastCleanup = localStorage.getItem('rota-facil-proof-cleanup');
  const today = new Date().toISOString().split('T')[0];
  if (lastCleanup !== today) {
    proofOfDelivery.cleanupOldProofs(30);
    localStorage.setItem('rota-facil-proof-cleanup', today);
  }
}
