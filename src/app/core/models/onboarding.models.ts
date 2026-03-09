export type OnboardingStep = 'Branch' | 'CashDrawer' | 'InitialCashOpen' | 'Product' | 'Stock' | 'Done';

export interface OnboardingStatusResponse {
    hasCreatedBranch: boolean;
    hasCreatedCashDrawer: boolean;
    hasCompletedInitialCashOpen: boolean;
    hasCreatedProduct: boolean;
    hasLoadedInitialStock: boolean;
    isCompleted: boolean;
    nextStep: OnboardingStep;
}
