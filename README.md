# AI RFP Response Generator

An intelligent Node.js application that analyzes RFP (Request for Proposal) documents and organization profiles to generate professional responses using Google's Gemini AI.

## Features

### 🔐 **User Authentication**
- **Email & Username Registration**: Users register with email, username (alphanumeric, lowercase, 3-20 chars)
- **Flexible Login**: Login with either email or username
- **JWT-based Sessions**: Secure token-based authentication
- **Session Management**: Server-side session invalidation support

### 🚀 **RFP Processing**
1. **File Upload & Analysis**: Upload RFP and organization documents (PDF, TXT, DOCX)
2. **Session-based Storage**: Each user session maintains uploaded files separately
3. **Gemini AI Integration**: Uses Google's Gemini AI for document analysis and response generation
4. **Requirements Mapping**: Automatically maps organization capabilities to RFP requirements
5. **Visual Analytics**: Interactive pie chart showing requirement matching strength
6. **DOCX Generation**: Creates professional Word documents for download
7. **Real-time Processing**: Dynamic UI with loading states and progress tracking

### 🛠️ **Admin Features**
- **Session Invalidation**: Force logout all users globally
- **Token Management**: Individual token invalidation on logout

## Technologies Used

- **Backend**: Node.js, Express.js, Multer, Express-Session
- **AI**: Google Gemini API (@google/generative-ai)
- **File Processing**: pdf-parse, mammoth, docx
- **Frontend**: Vanilla JavaScript, HTML5, CSS3, Canvas API
- **Document Generation**: docx library for Word document creation

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd node_proposal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

4. **Get a Gemini API Key**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key to your `.env` file

## Usage

### Local Development (macOS)

1. **Quick Start**:
   ```bash
   ./scripts/start-local.sh
   ```

2. **Manual Setup**:
   ```bash
   npm start    # Production
   npm run dev  # Development with auto-restart
   ```

3. **Access Application**:
   - Login Page: http://localhost:3000/login.html
   - Main App: http://localhost:3000/app (requires authentication)

4. **Create Account & Upload Documents**:
   - Step 1: Register with email, username, and password
   - Step 2: Upload your RFP document (PDF, TXT, or DOCX)
   - Step 3: Upload your organization profile document
   - Step 4: Review the generated prompt and create the response

### Session Management

**Invalidate All User Sessions**:
- Click the red shield icon (🛡️) in the header after logging in, or
- Use browser console: `invalidateAllSessions()`
- API: `POST /api/auth/invalidate-all-sessions`

## API Endpoints

### File Upload
- `POST /api/upload/rfp` - Upload and analyze RFP document
- `POST /api/upload/organization` - Upload and analyze organization document

### Document Generation
- `POST /api/generate/docx` - Generate DOCX response document
- `GET /api/download/:filename` - Download generated document

### Session Management
- `GET /api/session` - Get current session status
- `POST /api/session/clear` - Clear current session

## File Support

The application supports the following file formats:
- **PDF**: Extracted using pdf-parse
- **DOCX**: Processed using mammoth
- **TXT**: Direct text reading

Maximum file size: 10MB per file

## Architecture

### Backend Structure
```
server.js                 # Main server file
├── File Processing       # PDF, DOCX, TXT extraction
├── Gemini Integration   # AI analysis and response generation
├── Session Management   # User session handling
├── Document Generation  # DOCX creation
└── API Routes          # RESTful endpoints
```

### Frontend Structure
```
public/
├── index.html          # Main HTML file
└── src/
    ├── js/main.js      # Application logic
    ├── styles/main.css # Styling
    └── assets/         # Images and assets
```

## Session Management

Each user session maintains:
- Uploaded RFP file and analysis
- Organization file and analysis
- Requirements matching data
- Generated document information

Sessions expire after 24 hours and are automatically cleaned up.

## Error Handling

The application includes comprehensive error handling for:
- Invalid file types
- File size limits
- API failures
- Network issues
- Session timeouts

## Security Features

- File type validation
- File size limits
- Session-based isolation
- Error message sanitization
- Secure file storage

## Development

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run build` - Build frontend assets (if using Vite)

### Adding New Features
1. Backend changes go in `server.js`
2. Frontend changes go in `public/src/js/main.js`
3. Styling changes go in `public/src/styles/main.css`

## Troubleshooting

### Common Issues

1. **Gemini API Key Not Working**
   - Verify the API key is correct in `.env`
   - Check that you have credits/quota available
   - Ensure the key has proper permissions

2. **File Upload Fails**
   - Check file size (max 10MB)
   - Verify file type (PDF, TXT, DOCX only)
   - Ensure sufficient disk space

3. **Session Issues**
   - Sessions expire after 24 hours
   - Clear browser cookies if needed
   - Restart the server to reset all sessions

### Logs
Server logs include detailed information about:
- File processing
- AI API calls
- Error messages
- Session management

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review server logs
3. Create an issue on GitHub