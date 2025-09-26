/**
 * Workflow Management Module
 * Handles the tab-based workflow navigation and step progression
 */

export class WorkflowManager {
    constructor(options = {}) {
        this.currentStep = 1;
        this.completedSteps = [];
        this.maxSteps = options.maxSteps || 4;
        this.workflowTabs = document.getElementById('workflowTabs');

        // Event callbacks
        this.onStepChange = options.onStepChange || (() => {});
        this.onStepComplete = options.onStepComplete || (() => {});

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateTabStates();
    }

    bindEvents() {
        if (this.workflowTabs) {
            this.workflowTabs.addEventListener('click', (e) => {
                const tab = e.target.closest('.workflow-tab');
                if (!tab || tab.disabled) return;

                const step = parseInt(tab.dataset.step);
                this.switchToStep(step);
            });
        }
    }

    switchToStep(step) {
        if (step < 1 || step > this.maxSteps) {
            console.warn(`Invalid step: ${step}`);
            return;
        }

        const previousStep = this.currentStep;
        this.currentStep = step;

        this.updateActiveTab();
        this.updateActiveContent();

        // Trigger callback
        this.onStepChange(step, previousStep);
    }

    updateActiveTab() {
        document.querySelectorAll('.workflow-tab').forEach(tab => {
            const tabStep = parseInt(tab.dataset.step);
            tab.classList.remove('active');

            if (tabStep === this.currentStep) {
                tab.classList.add('active');
            }
        });
    }

    updateActiveContent() {
        document.querySelectorAll('.workflow-step').forEach(stepElement => {
            const stepNum = parseInt(stepElement.dataset.step);
            stepElement.classList.remove('active');

            if (stepNum === this.currentStep) {
                stepElement.classList.add('active');
            }
        });
    }

    markStepCompleted(step) {
        if (step < 1 || step > this.maxSteps) {
            console.warn(`Invalid step for completion: ${step}`);
            return;
        }

        if (!this.completedSteps.includes(step)) {
            this.completedSteps.push(step);
            this.onStepComplete(step);
        }

        this.updateTabStates();
    }

    updateTabStates() {
        document.querySelectorAll('.workflow-tab').forEach(tab => {
            const step = parseInt(tab.dataset.step);

            // Remove existing state classes
            tab.classList.remove('completed');

            // Mark completed steps
            if (this.completedSteps.includes(step)) {
                tab.classList.add('completed');
            }

            // Enable/disable tabs based on progress flow
            this.updateTabAccessibility(tab, step);
        });
    }

    updateTabAccessibility(tab, step) {
        if (step === 1) {
            // Step 1 is always available
            tab.disabled = false;
        } else if (this.completedSteps.length === 0) {
            // No steps completed yet, only step 1 is available
            tab.disabled = true;
        } else if (step <= Math.max(...this.completedSteps) + 1) {
            // Can access next step after completing previous steps
            tab.disabled = false;
        } else {
            // Future steps are disabled
            tab.disabled = true;
        }
    }

    enableNextStep() {
        this.markStepCompleted(this.currentStep);

        // If there's a next step, enable it
        if (this.currentStep < this.maxSteps) {
            const nextStep = this.currentStep + 1;
            const nextTab = document.getElementById(`tab-step-${nextStep}`);
            if (nextTab) {
                nextTab.disabled = false;
            }
        }
    }

    reset() {
        this.currentStep = 1;
        this.completedSteps = [];
        this.switchToStep(1);
        this.updateTabStates();
    }

    getProgress() {
        return {
            currentStep: this.currentStep,
            completedSteps: [...this.completedSteps],
            progressPercentage: (this.completedSteps.length / this.maxSteps) * 100
        };
    }

    setProgress(progress) {
        if (progress.currentStep) {
            this.currentStep = progress.currentStep;
        }
        if (progress.completedSteps) {
            this.completedSteps = [...progress.completedSteps];
        }
        this.switchToStep(this.currentStep);
        this.updateTabStates();
    }

    isStepAccessible(step) {
        if (step === 1) return true;
        if (this.completedSteps.length === 0) return false;
        return step <= Math.max(...this.completedSteps) + 1;
    }

    isStepCompleted(step) {
        return this.completedSteps.includes(step);
    }
}

// Export utility functions
export const WorkflowUtils = {
    validateStepNumber(step, maxSteps = 4) {
        return step >= 1 && step <= maxSteps && Number.isInteger(step);
    },

    calculateProgress(completedSteps, totalSteps = 4) {
        return Math.round((completedSteps.length / totalSteps) * 100);
    },

    getStepTitle(step) {
        const titles = {
            1: 'Upload RFP Document',
            2: 'Upload Organization Details',
            3: 'Draft Solution Outline',
            4: 'Review & Finalize'
        };
        return titles[step] || `Step ${step}`;
    }
};