from fastapi import FastAPI
from app.db.session import engine, Base
from app.models import qc
from app.api.endpoints import router as api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="LIMS-QC-Automate")

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"status": "OpenLIMS-QC System Online", "database": "Connected"}