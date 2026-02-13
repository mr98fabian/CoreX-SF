from backend.main import app

# This is necessary for Vercel to find the app instance
# when importing from a sibling directory
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
