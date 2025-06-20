import app
from run_api import load_config


if __name__ == "__main__":
    import uvicorn

    config = load_config()
    uvicorn.run(app, host=config["host"], port=config["port"])
