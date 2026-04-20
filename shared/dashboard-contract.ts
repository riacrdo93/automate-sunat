export type SaleStatus = "new" | "drafted" | "ready_for_review" | "submitted" | "failed";
export type AttemptStatus = "drafted" | "ready_for_review" | "submitted" | "failed";

export interface CustomerData {
  name: string;
  documentNumber: string;
  email?: string;
}

export interface SaleItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  tax?: number;
  documentType?: string;
}

export interface Sale {
  externalId: string;
  issuedAt: string;
  currency: string;
  customer: CustomerData;
  items: SaleItem[];
  totals: {
    subtotal: number;
    tax: number;
    total: number;
  };
  raw: Record<string, unknown>;
  fingerprint: string;
}

export interface InvoiceDraft {
  id: string;
  saleExternalId: string;
  issueDate: string;
  currency: string;
  customer: CustomerData;
  items: SaleItem[];
  totals: {
    subtotal: number;
    tax: number;
    total: number;
  };
}

export interface Artifact {
  kind: "screenshot" | "trace" | "html" | "file";
  path: string;
}

export interface InvoiceAttemptRecord {
  id: string;
  saleExternalId: string;
  status: AttemptStatus;
  draft: InvoiceDraft;
  artifacts: Artifact[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  receiptNumber?: string;
  receiptPrefix?: string;
  error?: string;
}

export interface SaleRecordSummary {
  externalId: string;
  status: SaleStatus;
  issuedAt: string;
  customerName: string;
  customerDocument: string;
  subtotal: number;
  tax: number;
  total: number;
  documentProgress?: string;
  detailUrl?: string;
  items: SaleItem[];
  attemptId?: string;
  updatedAt: string;
}

export interface RunRecordSummary {
  id: string;
  reason: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  endedAt?: string;
  summary: Record<string, unknown>;
}

export type WorkflowStepStatus = "pending" | "active" | "completed" | "failed";

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: WorkflowStepStatus;
}

export interface WorkflowStage {
  id: string;
  title: string;
  description: string;
  status: WorkflowStepStatus;
  steps: WorkflowStep[];
  outputPath?: string;
  outputCount?: number;
}

export interface WorkflowLogEntry {
  at: string;
  level: "info" | "error" | "debug";
  stageId: string;
  stepId: string;
  message: string;
  saleExternalId?: string;
}

export interface DashboardRunEntry {
  attemptId: string;
  saleExternalId: string;
  status: AttemptStatus;
  createdAt: string;
  updatedAt: string;
  issuedAt: string;
  customerName: string;
  customerDocument: string;
  subtotal: number;
  tax: number;
  total: number;
  items: SaleItem[];
  artifacts: Artifact[];
  documentProgress?: string;
  receiptNumber?: string;
  receiptPrefix?: string;
  error?: string;
}

export interface DashboardRunRecord extends RunRecordSummary {
  entries: DashboardRunEntry[];
  workflowStages: WorkflowStage[];
  logs: WorkflowLogEntry[];
  outputJsonPath?: string;
  outputJsonContent?: string;
}

export interface AutomationAccountSummary {
  id: string;
  label: string;
  sellerUsername: string;
  sunatRuc: string;
  sunatUsername: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationAccountPayload {
  label: string;
  sellerUsername: string;
  sellerPassword: string;
  sunatRuc: string;
  sunatUsername: string;
  sunatPassword: string;
}

export interface DashboardSnapshot {
  config: {
    profile: string;
    runMode: "manual" | "hourly" | "both";
    autoContinueStepTwo: boolean;
    checkIntervalMinutes: number;
    headful: boolean;
    baseUrl: string;
  };
  accounts: AutomationAccountSummary[];
  runtime: {
    isRunning: boolean;
    currentRunId?: string;
    currentSaleId?: string;
    currentStep: string;
    currentAccountId?: string;
    lastCheckAt?: string;
    nextCheckAt?: string;
    currentWorkflowStageId?: string;
    currentWorkflowStepId?: string;
    pendingApprovals: Array<{
      attemptId: string;
      saleExternalId: string;
      createdAt: string;
      live: boolean;
    }>;
    stepTwoReady: {
      available: boolean;
      pendingSales: number;
      message: string;
    };
  };
  sales: SaleRecordSummary[];
  attempts: InvoiceAttemptRecord[];
  runs: DashboardRunRecord[];
}
