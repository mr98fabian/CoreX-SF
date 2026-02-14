import sys
import os

# Add the backend directory to Python's path so that
# bare imports (from database import ...) resolve correctly
# inside Vercel's serverless runtime.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from backend.main import app

# This is necessary for Vercel to find the app instance
# when importing from a sibling directory
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
