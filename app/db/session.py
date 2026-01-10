from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# The DATABASE_URL is pulled from the environment variable defined in docker-compose.yml
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL is None:
    raise ValueError("DATABASE_URL environment variable is not set!")

# The engine is the actual connection to the database
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Each instance of the SessionLocal class will be a database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for classes to inherit from to produce database tables
Base = declarative_base()

# Dependency to get a DB session for each request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()