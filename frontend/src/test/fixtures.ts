import type {
  DashboardRunRecord,
  DashboardSnapshot,
  WorkflowStage,
} from "@shared/dashboard-contract";

const activeWorkflowStages: WorkflowStage[] = [
  {
    id: "detectar_ventas",
    title: "Paso 1: Obtener informacion de ventas",
    description: "Falabella se revisa para extraer ventas, DNI, productos y precios en un JSON.",
    status: "active",
    steps: [
      {
        id: "abrir_falabella",
        title: "Abrir Falabella",
        description: "Levantar la sesion y navegar al modulo de documentos.",
        status: "completed",
      },
      {
        id: "filtrar_ventas_pendientes",
        title: "Encontrar ventas pendientes",
        description: "Filtrar ordenes sin comprobante cargado.",
        status: "completed",
      },
      {
        id: "leer_detalle_ventas",
        title: "Leer detalle de ventas",
        description: "Capturar DNI, cliente, productos y montos para cada orden.",
        status: "completed",
      },
      {
        id: "exportar_json",
        title: "Exportar salida JSON",
        description: "Guardar el resultado del paso 1 como salida reutilizable.",
        status: "active",
      },
    ],
  },
  {
    id: "registrar_facturas_sunat",
    title: "Paso 2: Registro de boleta electrónica",
    description: "Emision y registro de boletas en SUNAT; salida agrupada en ZIP.",
    status: "pending",
    steps: [
      {
        id: "abrir_sunat",
        title: "Abrir SUNAT",
        description: "Abrir el portal de emision.",
        status: "pending",
      },
      {
        id: "cargar_factura_en_sunat",
        title: "Cargar comprobante",
        description: "Completar cliente, items y montos.",
        status: "pending",
      },
      {
        id: "esperar_revision",
        title: "Esperar revision",
        description: "Esperar la decision humana antes del envio.",
        status: "pending",
      },
      {
        id: "enviar_factura",
        title: "Registrar en SUNAT",
        description: "Enviar el comprobante final.",
        status: "pending",
      },
    ],
  },
];

const activeRun: DashboardRunRecord = {
  id: "run-live",
  reason: "manual",
  status: "running",
  startedAt: "2026-03-28T15:00:00.000Z",
  summary: {
    observedSales: 2,
    queuedSales: 2,
    submittedInvoices: 0,
    failedInvoices: 0,
    cancelledInvoices: 0,
  },
  entries: [],
  workflowStages: activeWorkflowStages,
  logs: [
    {
      at: "2026-03-28T15:01:00.000Z",
      level: "info",
      stageId: "detectar_ventas",
      stepId: "abrir_falabella",
      message: "Sincronizando cookies del seller",
    },
    {
      at: "2026-03-28T15:05:00.000Z",
      level: "info",
      stageId: "detectar_ventas",
      stepId: "leer_detalle_ventas",
      message: "Se detectaron 2 ventas pendientes en Falabella.",
    },
    {
      at: "2026-03-28T15:10:00.000Z",
      level: "info",
      stageId: "detectar_ventas",
      stepId: "exportar_json",
      message: "Se exporto el JSON del paso 1 en /tmp/falabella/latest.json.",
    },
  ],
  outputJsonPath: "/tmp/falabella/latest.json",
  outputJsonContent: JSON.stringify(
    [
      {
        orderNumber: "ORDER-1001",
        dni: "45896521",
        customerName: "Ana Ruiz",
        total: 118,
        items: [
          {
            productName: "Zapato urbano",
            unitPrice: 118,
          },
        ],
      },
      {
        orderNumber: "ORDER-1002",
        dni: "71458963",
        customerName: "Luis Paredes",
        total: 236,
        items: [
          {
            productName: "Casaca deportiva",
            unitPrice: 236,
          },
        ],
      },
    ],
    null,
    2,
  ),
};

const historicalRun: DashboardRunRecord = {
  id: "run-history",
  reason: "retry",
  status: "completed",
  startedAt: "2026-03-27T10:00:00.000Z",
  endedAt: "2026-03-27T10:18:00.000Z",
  summary: {
    observedSales: 4,
    queuedSales: 4,
    submittedInvoices: 0,
    failedInvoices: 0,
    cancelledInvoices: 0,
  },
  entries: [],
  workflowStages: [],
  logs: [],
  outputJsonPath: "/tmp/falabella/historical.json",
  outputJsonContent: JSON.stringify(
    [
      {
        orderNumber: "ORDER-0901",
        dni: "41896532",
        customerName: "Marta Silva",
        total: 59,
        items: [
          {
            productName: "Polo basico",
            unitPrice: 59,
          },
        ],
      },
    ],
    null,
    2,
  ),
};

const baseSnapshot: DashboardSnapshot = {
  config: {
    profile: "custom",
    runMode: "manual",
    checkIntervalMinutes: 30,
    headful: false,
    baseUrl: "http://localhost:3030",
  },
  runtime: {
    isRunning: true,
    currentRunId: "run-live",
    currentSaleId: "ORDER-1001",
    currentStep: "Exportando JSON de ventas",
    lastCheckAt: "2026-03-28T15:10:00.000Z",
    nextCheckAt: "2026-03-28T15:40:00.000Z",
    currentWorkflowStageId: "detectar_ventas",
    currentWorkflowStepId: "exportar_json",
    pendingApprovals: [],
    stepTwoReady: {
      available: true,
      pendingSales: 1,
      message: "1 venta(s) guardada(s) del paso 1 listas para ejecutar solo el paso 2.",
    },
  },
  sales: [
    {
      externalId: "ORDER-1001",
      status: "new",
      issuedAt: "2026-03-28T14:58:00.000Z",
      customerName: "Ana Ruiz",
      customerDocument: "45896521",
      subtotal: 100,
      tax: 18,
      total: 118,
      items: [
        {
          description: "Zapato urbano",
          quantity: 1,
          unitPrice: 118,
          total: 118,
        },
      ],
      updatedAt: "2026-03-28T15:10:00.000Z",
    },
  ],
  attempts: [],
  runs: [activeRun, historicalRun],
};

type SnapshotOverrides = Partial<DashboardSnapshot> & {
  runtime?: Partial<DashboardSnapshot["runtime"]>;
  runs?: DashboardRunRecord[];
};

export function createSnapshot(overrides: SnapshotOverrides = {}): DashboardSnapshot {
  const snapshot = structuredClone(baseSnapshot);

  return {
    ...snapshot,
    ...overrides,
    runtime: {
      ...snapshot.runtime,
      ...overrides.runtime,
    },
    runs: overrides.runs ?? snapshot.runs,
  };
}

export function createActiveRun() {
  return structuredClone(activeRun);
}

export function createHistoricalRun() {
  return structuredClone(historicalRun);
}
