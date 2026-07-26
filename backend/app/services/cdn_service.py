import os
from typing import BinaryIO
from app.services.interfaces import BasePDFService

try:
    import zcatalyst_sdk
    catalyst_available = True
except ImportError:
    catalyst_available = False

class BaseCDNService:
    def upload_file(self, file_name: str, file_data: BinaryIO) -> str:
        """Uploads file and returns public CDN URL or local path reference."""
        pass


class CatalystCDNService(BaseCDNService):
    def __init__(self):
        # Initialized on demand via zcatalyst_sdk
        self.app = zcatalyst_sdk.initialize()

    def upload_file(self, file_name: str, file_data: BinaryIO) -> str:
        try:
            # Upload to Catalyst Stratus Cloud Storage
            bucket = self.app.filestore().bucket("case-assets")
            file_ref = bucket.upload_file(file_data, file_name)
            return file_ref.get_download_url()
        except Exception as e:
            # Fallback if bucket doesn't exist
            return f"/local-uploads/{file_name}"


class LocalCDNService(BaseCDNService):
    def __init__(self):
        self.upload_dir = "/Volumes/DiskD/HACKATHONS/Vyuha-Network/backend/data/uploads"
        os.makedirs(self.upload_dir, exist_ok=True)

    def upload_file(self, file_name: str, file_data: BinaryIO) -> str:
        dest_path = os.path.join(self.upload_dir, file_name)
        with open(dest_path, "wb") as f:
            f.write(file_data.read())
        return f"/static/uploads/{file_name}"


class CDNServiceFactory:
    @staticmethod
    def get_cdn_service() -> BaseCDNService:
        if catalyst_available and os.getenv("CATALYST_PROJECT_KEY"):
            return CatalystCDNService()
        return LocalCDNService()
