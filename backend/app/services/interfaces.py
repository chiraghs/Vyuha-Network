from abc import ABC, abstractmethod
from sqlalchemy.orm import Session

class BaseAIService(ABC):
    @abstractmethod
    def analyze_crime_pattern(self, query_text: str, historical_records: list) -> dict:
        """Analyze crime patterns across unstructured case logs."""
        pass

    @abstractmethod
    def calculate_risk_score_explanation(self, criminal_name: str, priors_count: int, crime_types: list) -> str:
        """Explain recidivism risk score calculation in a Chain-of-Thought format."""
        pass

    @abstractmethod
    def translate_kannada_query(self, query_text: str) -> dict:
        """Bidirectionally translate English and Kannada queries."""
        pass

    @abstractmethod
    def transcribe_kannada_audio(self, audio_bytes: bytes) -> str:
        """Convert Kannada voice recordings to text."""
        pass

class BaseNetworkService(ABC):
    @abstractmethod
    def get_criminal_network(self, db: Session) -> dict:
        """Build node-link structures and connection metrics for criminal links."""
        pass

class BasePDFService(ABC):
    @abstractmethod
    def generate_chat_report(self, query_history: list) -> bytes:
        """Compile chat history logs into signed PDF files."""
        pass
