# JavaScript Modules Architecture

This directory contains the modular JavaScript architecture for the RFP Proposal Generator application.

## Directory Structure

```
js/
├── modules/
│   ├── api.js          # API service layer
│   ├── proposal.js     # Proposal management
│   ├── utils.js        # Utility functions
│   └── workflow.js     # Workflow tab management
├── app.js              # Main application orchestrator
├── index.js            # Entry point
└── README.md           # This documentation
```

## Modules Overview

### 1. API Service (`modules/api.js`)

Handles all HTTP communication with the backend.

**Key Classes:**
- `ApiService` - Main API service class
- `ApiError` - Custom error class for API operations
- `RequestInterceptor` - For adding request/response interceptors
- `ApiServiceFactory` - Factory for creating pre-configured instances

**Key Features:**
- Automatic authentication handling
- File upload/download support
- Error handling and retry logic
- Request/response interceptors

**Usage:**
```javascript
import { ApiService } from './modules/api.js';

const api = new ApiService();
const proposals = await api.getProposals();
```

### 2. Proposal Management (`modules/proposal.js`)

Manages proposal CRUD operations, state management, and UI updates.

**Key Classes:**
- `ProposalManager` - Main proposal management class

**Key Features:**
- Proposal CRUD operations
- Tree view rendering
- State management
- Event-driven architecture

**Usage:**
```javascript
import { ProposalManager } from './modules/proposal.js';

const proposalManager = new ProposalManager({
    apiService: api,
    onProposalSelect: (proposal) => console.log('Selected:', proposal)
});
```

### 3. Workflow Management (`modules/workflow.js`)

Handles the tab-based workflow navigation and step progression.

**Key Classes:**
- `WorkflowManager` - Main workflow management class
- `WorkflowUtils` - Utility functions for workflow operations

**Key Features:**
- Tab navigation
- Step progression logic
- Progress tracking
- Access control (can only advance after completing steps)

**Usage:**
```javascript
import { WorkflowManager } from './modules/workflow.js';

const workflow = new WorkflowManager({
    maxSteps: 4,
    onStepChange: (step) => console.log('Step changed:', step)
});
```

### 4. Utilities (`modules/utils.js`)

Common utility functions used across the application.

**Key Utilities:**
- `DomUtils` - DOM manipulation helpers
- `ThemeUtils` - Theme management
- `StorageUtils` - LocalStorage wrapper
- `ValidationUtils` - Input validation
- `StringUtils` - String manipulation
- `DateUtils` - Date formatting
- `FileUtils` - File handling
- `AsyncUtils` - Async operation helpers
- `EventEmitter` - Event management
- `Logger` - Logging utility

**Usage:**
```javascript
import { DomUtils, ThemeUtils } from './modules/utils.js';

const element = DomUtils.getElementById('myElement');
ThemeUtils.applyTheme('dark');
```

### 5. Main Application (`app.js`)

The main application orchestrator that ties all modules together.

**Key Classes:**
- `RfpProposalApp` - Main application class extending EventEmitter

**Key Features:**
- Module coordination
- Global event handling
- Application lifecycle management
- User authentication
- Error handling

**Usage:**
```javascript
import RfpProposalApp from './app.js';

const app = new RfpProposalApp();
await app.init();
```

## Event System

The application uses an event-driven architecture where modules communicate through events:

```javascript
// Listen for proposal selection
app.on('proposalSelected', ({ proposal }) => {
    console.log('Proposal selected:', proposal.name);
});

// Listen for workflow step changes
app.on('stepChanged', ({ step, previousStep }) => {
    console.log(`Step changed from ${previousStep} to ${step}`);
});
```

## Error Handling

The application implements comprehensive error handling:

1. **API Errors**: Handled by `ApiError` class with specific error types
2. **Validation Errors**: Caught at the UI level with user feedback
3. **Network Errors**: Automatic retry logic for recoverable errors
4. **Global Errors**: Centralized error handling in the main app

## Extensibility

### Adding New Modules

1. Create a new file in the `modules/` directory
2. Export your classes/functions
3. Import and integrate in `app.js`
4. Add documentation to this README

### Adding New Workflow Steps

1. Update the HTML to include new tabs
2. Modify `WorkflowManager.maxSteps`
3. Add step-specific logic in the main app
4. Update CSS for new step styling

### Adding New API Endpoints

1. Add methods to `ApiService` class
2. Update error handling if needed
3. Add corresponding UI logic in relevant managers

## Best Practices

1. **Separation of Concerns**: Each module has a specific responsibility
2. **Event-Driven**: Use events for loose coupling between modules
3. **Error Handling**: Always handle errors gracefully with user feedback
4. **Logging**: Use the Logger utility for debugging and monitoring
5. **Type Safety**: Use JSDoc comments for better IDE support
6. **Testing**: Each module can be tested independently

## Development Guidelines

1. **Module Independence**: Modules should not directly depend on each other's internals
2. **Configuration**: Use dependency injection for flexibility
3. **Event Naming**: Use descriptive event names (e.g., 'proposalSelected', not 'select')
4. **Error Propagation**: Let errors bubble up to the main app for centralized handling
5. **Documentation**: Keep this README updated when adding new modules

## Future Enhancements

1. **State Management**: Consider adding a Redux-like state management system
2. **Testing Framework**: Add unit tests for each module
3. **TypeScript**: Migrate to TypeScript for better type safety
4. **Service Workers**: Add offline support and caching
5. **Lazy Loading**: Implement dynamic module loading for better performance