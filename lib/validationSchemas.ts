import { z } from 'zod'

// ✅ SCHEMA: Item ECT
export const ECTItemSchema = z.object({
  sequence: z.number().min(1),
  objectCode: z.string().min(1),
  address: z.string().min(5),
  cep: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  correctedAddress: z.string().optional(),
})

// ✅ SCHEMA: Configuração de Automação
export const AutoRouteConfigSchema = z.object({
  mode: z.enum(['manual', 'semi-auto', 'full-auto']),
  preferences: z.object({
    avoidTraffic: z.boolean(),
    preferHighways: z.boolean(),
    timeWindows: z.array(z.string()),
    fuelEfficiency: z.boolean(),
    autoOptimize: z.boolean(),
  }),
  constraints: z.object({
    maxDistance: z.number().min(1).max(1000),
    maxTime: z.number().min(60).max(1440),
    breakIntervals: z.number().min(15).max(120),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  }),
  notifications: z.object({
    routeReady: z.boolean(),
    deliveryUpdates: z.boolean(),
    performanceAlerts: z.boolean(),
  }),
})

// ✅ SCHEMA: Rota Agendada
export const ScheduledRouteSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  items: z.array(ECTItemSchema),
  status: z.enum(['pending', 'processing', 'ready', 'delivered']),
})

// ✅ SCHEMA: Dados de Rota Otimizada
export const OptimizedRouteDataSchema = z.object({
  route: z.array(ECTItemSchema),
  totalDistance: z.number().min(0),
  totalTime: z.number().min(0),
  algorithm: z.string(),
  googleMapsUrl: z.string().url(),
})

// ✅ SCHEMA: Ponto da Rota
export const RoutePointSchema = z.object({
  id: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string(),
  sequence: z.number().optional(),
  priority: z.number().min(1).max(10).optional(),
  timeWindow: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
})

// ✅ SCHEMA: Opções de Otimização
export const OptimizationOptionsSchema = z.object({
  algorithm: z.enum(['nearest-neighbor', 'two-opt', 'genetic', 'ant-colony', 'auto']),
  maxIterations: z.number().min(1).max(10000),
  timeLimit: z.number().min(1000).max(300000),
  constraints: z.object({
    maxDistance: z.number().min(0),
    maxTime: z.number().min(0),
    timeWindows: z.boolean(),
    priorities: z.boolean(),
  }),
})

// ✅ SCHEMA: Resultado da Otimização
export const OptimizationResultSchema = z.object({
  route: z.array(RoutePointSchema),
  totalDistance: z.number().min(0),
  totalTime: z.number().min(0),
  algorithm: z.string(),
  processingTime: z.number().min(0),
  improvements: z.object({
    distanceSaved: z.number(),
    timeSaved: z.number(),
    percentageImprovement: z.number(),
  }),
})

// ✅ SCHEMA: Dados da Tarefa
export const TaskDataSchema = z.object({
  points: z.array(RoutePointSchema).optional(),
  algorithm: z.string().optional(),
  options: OptimizationOptionsSchema.optional(),
  message: z.string().optional(),
  recipient: z.string().email().optional(),
})

// ✅ SCHEMA: Resultado da Tarefa
export const TaskResultSchema = z.object({
  route: z.array(RoutePointSchema).optional(),
  totalDistance: z.number().optional(),
  algorithm: z.string().optional(),
  processingTime: z.number().optional(),
  processed: z.boolean().optional(),
  timestamp: z.number().optional(),
  dataSize: z.number().optional(),
})

// ✅ SCHEMA: Tarefa em Background
export const BackgroundTaskSchema = z.object({
  id: z.string(),
  type: z.enum(['route-optimization', 'data-processing', 'notification-send']),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.number().min(0).max(100),
  data: TaskDataSchema,
  result: TaskResultSchema.optional(),
  error: z.string().optional(),
  createdAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
})

// ✅ SCHEMA: Configuração do Processador
export const BackgroundProcessorConfigSchema = z.object({
  maxConcurrentTasks: z.number().min(1).max(10),
  taskTimeout: z.number().min(1000).max(600000),
  retryAttempts: z.number().min(0).max(5),
  enableNotifications: z.boolean(),
  storageKey: z.string(),
})

// ✅ FUNÇÕES DE VALIDAÇÃO
export function validateECTItem(data: unknown) {
  return ECTItemSchema.parse(data)
}

export function validateAutoRouteConfig(data: unknown) {
  return AutoRouteConfigSchema.parse(data)
}

export function validateScheduledRoute(data: unknown) {
  return ScheduledRouteSchema.parse(data)
}

export function validateOptimizedRouteData(data: unknown) {
  return OptimizedRouteDataSchema.parse(data)
}

export function validateRoutePoint(data: unknown) {
  return RoutePointSchema.parse(data)
}

export function validateOptimizationOptions(data: unknown) {
  return OptimizationOptionsSchema.parse(data)
}

export function validateOptimizationResult(data: unknown) {
  return OptimizationResultSchema.parse(data)
}

export function validateTaskData(data: unknown) {
  return TaskDataSchema.parse(data)
}

export function validateTaskResult(data: unknown) {
  return TaskResultSchema.parse(data)
}

export function validateBackgroundTask(data: unknown) {
  return BackgroundTaskSchema.parse(data)
}

export function validateBackgroundProcessorConfig(data: unknown) {
  return BackgroundProcessorConfigSchema.parse(data)
}

// ✅ FUNÇÕES DE VALIDAÇÃO SEGURA (não lançam erro)
export function safeValidateECTItem(data: unknown) {
  return ECTItemSchema.safeParse(data)
}

export function safeValidateAutoRouteConfig(data: unknown) {
  return AutoRouteConfigSchema.safeParse(data)
}

export function safeValidateScheduledRoute(data: unknown) {
  return ScheduledRouteSchema.safeParse(data)
}

export function safeValidateOptimizedRouteData(data: unknown) {
  return OptimizedRouteDataSchema.safeParse(data)
}

export function safeValidateRoutePoint(data: unknown) {
  return RoutePointSchema.safeParse(data)
}

export function safeValidateOptimizationOptions(data: unknown) {
  return OptimizationOptionsSchema.safeParse(data)
}

export function safeValidateOptimizationResult(data: unknown) {
  return OptimizationResultSchema.safeParse(data)
}

export function safeValidateTaskData(data: unknown) {
  return TaskDataSchema.safeParse(data)
}

export function safeValidateTaskResult(data: unknown) {
  return TaskResultSchema.safeParse(data)
}

export function safeValidateBackgroundTask(data: unknown) {
  return BackgroundTaskSchema.safeParse(data)
}

export function safeValidateBackgroundProcessorConfig(data: unknown) {
  return BackgroundProcessorConfigSchema.safeParse(data)
}
