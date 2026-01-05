from fastapi import FastAPI
from app.db.session import engine, Base
from app.models import qc

Base.metadata.create_all(bind=engine)

app = FastAPI(title="LIMS-QC-Automate")

@app.get("/")
def read_root():
    return {"status": "OpenLIMS-QC System Online", "database": "Connected"}