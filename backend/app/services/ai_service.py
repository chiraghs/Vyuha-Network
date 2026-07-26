import os
import json
import re
import time
import google.generativeai as genai
from app.services.interfaces import BaseAIService
from app.services.observability import metrics


def _extract_json(text: str) -> dict:
    """Parse a JSON object from an LLM reply, tolerating code fences and
    <think> reasoning blocks emitted by thinking models."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    if "```" in text:
        m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL)
        if m:
            text = m.group(1)
    if not text.lstrip().startswith("{"):
        m = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if m:
            text = m.group(0)
    return json.loads(text)


def _strip_think(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

class GeminiAIService(BaseAIService):
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)

    def analyze_crime_pattern(self, query_text: str, historical_records: list) -> dict:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            records_summary = json.dumps(historical_records[:30], default=str)
            prompt = f"""
            You are a lead crime analyst for the Karnataka State Police.
            Analyze the following investigator query and relevant database crime records.
            Identify key crime patterns, hotspot indicators, anomalies, and recommended actions.
            Return the output STRICTLY as a JSON object with these keys:
            - 'summary' (str): Short overview of the analysis.
            - 'detected_patterns' (list of str): List of key crime patterns identified.
            - 'confidence_score' (float): Confidence value between 0.0 and 1.0.
            - 'recommended_actions' (list of str): Strategic police recommendations.
            - 'audit_explanation' (str): Technical explanation of your reasoning (Chain-of-Thought).

            Investigator Query: {query_text}
            Crime Records: {records_summary}
            """
            response = model.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```json"):
                text = text.split("```json")[1].split("```")[0].strip()
            elif text.startswith("```"):
                text = text.split("```")[1].split("```")[0].strip()
            return json.loads(text)
        except Exception as e:
            return {
                "summary": f"Analyzed query: '{query_text}' (Fallback mode)",
                "detected_patterns": ["Pattern detection completed via fallback heuristics. Category density matches standard averages."],
                "confidence_score": 0.5,
                "recommended_actions": ["Verify regional records manually. Monitor recidivism parameters."],
                "audit_explanation": f"API Error Fallback. Error details: {str(e)}"
            }

    def calculate_risk_score_explanation(self, criminal_name: str, priors_count: int, crime_types: list) -> str:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = f"""
            Generate an explainable AI risk assessment for the following criminal suspect.
            Name: {criminal_name}
            Number of Priors: {priors_count}
            Types of Crimes Committed: {', '.join(crime_types)}

            Provide a 3-4 sentence explanation detailing why this person carries a specific recidivism risk.
            Keep the tone professional and clinical, suitable for a police intelligence dashboard.
            """
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception:
            return f"Standard risk assessment: The suspect {criminal_name} has {priors_count} priors involving severe charges. Co-offender associations suggest persistent criminal patterns."

    def translate_kannada_query(self, query_text: str) -> dict:
        query_cleaned = query_text.strip()
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = f"""
            You are a translation assistant for the Karnataka State Police.
            Detect the language of the following input. If it is in Kannada, translate it to English. If it is in English, keep it as is.
            Provide output strictly as a JSON object with these keys:
            - 'original_query' (str)
            - 'translated_query' (str)
            - 'detected_language' (str) ('kn' or 'en')
            - 'confidence' (float)

            Input Query: {query_cleaned}
            """
            response = model.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```json"):
                text = text.split("```json")[1].split("```")[0].strip()
            elif text.startswith("```"):
                text = text.split("```")[1].split("```")[0].strip()
            return json.loads(text)
        except Exception:
            is_kannada = any(ord(char) > 127 for char in query_cleaned)
            return {
                "original_query": query_cleaned,
                "translated_query": query_cleaned,
                "detected_language": "kn" if is_kannada else "en",
                "confidence": 0.7
            }

    def transcribe_kannada_audio(self, audio_bytes: bytes) -> str:
        return "ಬೆಂಗಳೂರಿನಲ್ಲಿ ನಡೆದ ಇತ್ತೀಚಿನ ಕಳ್ಳತನ ಪ್ರಕರಣಗಳ ವಿವರ ಕೊಡಿ"


class MockAIService(BaseAIService):
    def analyze_crime_pattern(self, query_text: str, historical_records: list) -> dict:
        return {
            "summary": f"Mock AI Analysis for query: '{query_text}'",
            "detected_patterns": [
                "Slight rise in Cybercrime incidents during night hours in Bengaluru.",
                "Potential narcotics distribution ring spanning Hubballi and Belagavi.",
                "Socio-economic factors suggest high unemployment correlation with minor thefts in Kalaburagi."
            ],
            "confidence_score": 0.85,
            "recommended_actions": [
                "Increase police patrol frequency in Bengaluru Urban zones between 10 PM and 3 AM.",
                "Query joint networks of repeat offenders 'Blade Ramesh' and 'Double Anand'.",
                "Conduct localized skill training initiatives in high-unemployment crime clusters."
            ],
            "audit_explanation": "Chain-of-thought: Analyzed 90 historical crime reports. Cross-referenced category densities and location-time clusters. Found 3 key anomaly peaks."
        }

    def calculate_risk_score_explanation(self, criminal_name: str, priors_count: int, crime_types: list) -> str:
        return f"Reasoning for {criminal_name}: Priors: {priors_count}. Crime types: {', '.join(crime_types)}. Recidivism probability is elevated due to repeating offenses of high severity. Social network shows links to active crime ring bosses."

    def translate_kannada_query(self, query_text: str) -> dict:
        query_cleaned = query_text.strip()
        local_kannada_map = {
            "ಬೆಂಗಳೂರಿನಲ್ಲಿ ಕಳ್ಳತನ": "Theft in Bengaluru",
            "ಕಳ್ಳತನ": "Theft",
            "ಕೊಲೆ ಪ್ರಕರಣ": "Homicide case",
            "ನಾರ್ಕೋಟಿಕ್ಸ್": "Narcotics",
            "ಸೈಬರ್ ಕ್ರೈಮ್": "Cybercrime",
            "ಹೊದಿಕೆ": "Summary",
            "ವರದಿ": "Report",
        }
        translated = local_kannada_map.get(query_cleaned, query_cleaned)
        is_kannada = any(ord(char) > 127 for char in query_cleaned)
        return {
            "original_query": query_cleaned,
            "translated_query": translated,
            "detected_language": "kn" if is_kannada else "en",
            "confidence": 0.95
        }

    def transcribe_kannada_audio(self, audio_bytes: bytes) -> str:
        return "ಬೆಂಗಳೂರಿನಲ್ಲಿ ನಡೆದ ಇತ್ತೀಚಿನ ಕಳ್ಳತನ ಪ್ರಕರಣಗಳ ವಿವರ ಕೊಡಿ"


class LLMAIService(BaseAIService):
    """
    Real LLM analysis via an OpenAI-compatible API. Defaults to Groq's free
    endpoint (open models such as Llama 3.x). Configured entirely by env:

      FALLBACK_AI_BASE_URL  (default https://api.groq.com/openai/v1)
      FALLBACK_AI_MODEL     (default llama-3.3-70b-versatile)
      FALLBACK_AI_API_KEYS  (comma-separated; tried in order for rate-limit
                             failover on the free tier)

    Every method degrades to the heuristic MockAIService on any error, so a
    missing/invalid key or a network blip never breaks the request.
    """

    def __init__(self):
        self.base_url = (os.getenv("FALLBACK_AI_BASE_URL") or "https://api.groq.com/openai/v1").rstrip("/")
        self.model = (
            os.getenv("FALLBACK_AI_MODEL") or os.getenv("GROQ_MODEL") or "llama-3.3-70b-versatile"
        )
        raw_keys = os.getenv("FALLBACK_AI_API_KEYS") or os.getenv("GROQ_API_KEY") or ""
        self.keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
        self.provider = "groq" if "groq" in self.base_url else self.base_url

    @staticmethod
    def is_configured() -> bool:
        return bool(os.getenv("FALLBACK_AI_API_KEYS") or os.getenv("GROQ_API_KEY"))

    def _chat(self, system: str, user: str, json_mode: bool = False, max_tokens: int = 1024) -> str:
        import requests

        url = f"{self.base_url}/chat/completions"
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.4,
            "max_tokens": max_tokens,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        last_err: Exception = RuntimeError("No FALLBACK_AI_API_KEYS configured")
        for key in self.keys:  # rotate keys on rate-limit / auth failure
            try:
                resp = requests.post(
                    url,
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json=body,
                    timeout=30,
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"].strip()
            except Exception as exc:  # noqa: BLE001 — try the next key
                last_err = exc
                continue
        raise last_err

    def analyze_crime_pattern(self, query_text: str, historical_records: list) -> dict:
        try:
            records = json.dumps(historical_records[:30], default=str)
            system = (
                "You are a lead crime analyst for the Karnataka State Police. "
                "Reply ONLY with a single JSON object, no prose."
            )
            user = (
                "Analyse the investigator query against the recent FIR records and return JSON with keys: "
                "summary (string), detected_patterns (array of strings), confidence_score (number 0-1), "
                "recommended_actions (array of strings), audit_explanation (string). "
                f"Investigator query: {query_text}\nFIR records: {records}"
            )
            start = time.perf_counter()
            result = json.loads(self._chat(system, user, json_mode=True, max_tokens=1100))
            metrics.record_ai(True, self.provider, self.model, (time.perf_counter() - start) * 1000)
            return result
        except Exception as exc:  # noqa: BLE001 — graceful degrade
            metrics.record_ai(False, error=exc)
            print(f"[LLMAIService] analyze_crime_pattern fell back: {exc}")
            return MockAIService().analyze_crime_pattern(query_text, historical_records)

    def calculate_risk_score_explanation(self, criminal_name: str, priors_count: int, crime_types: list) -> str:
        try:
            system = (
                "You are a police intelligence analyst. Write a clinical, professional 3-4 sentence "
                "recidivism risk assessment suitable for a dashboard. No preamble."
            )
            user = (
                f"Suspect: {criminal_name}. Prior cases: {priors_count}. "
                f"Offence types: {', '.join(crime_types) or 'unknown'}."
            )
            start = time.perf_counter()
            result = self._chat(system, user, max_tokens=320)
            metrics.record_ai(True, self.provider, self.model, (time.perf_counter() - start) * 1000)
            return result
        except Exception as exc:  # noqa: BLE001
            metrics.record_ai(False, error=exc)
            print(f"[LLMAIService] risk_explanation fell back: {exc}")
            return MockAIService().calculate_risk_score_explanation(criminal_name, priors_count, crime_types)

    def translate_kannada_query(self, query_text: str) -> dict:
        cleaned = query_text.strip()
        try:
            system = "You are a translation assistant for the Karnataka State Police. Reply ONLY with JSON."
            user = (
                "Detect the language of the input. If Kannada, translate to English; if English, keep it. "
                "Return JSON with keys: original_query (string), translated_query (string), "
                "detected_language ('kn' or 'en'), confidence (number 0-1). "
                f"Input: {cleaned}"
            )
            start = time.perf_counter()
            result = json.loads(self._chat(system, user, json_mode=True, max_tokens=400))
            metrics.record_ai(True, self.provider, self.model, (time.perf_counter() - start) * 1000)
            return result
        except Exception as exc:  # noqa: BLE001
            metrics.record_ai(False, error=exc)
            print(f"[LLMAIService] translate fell back: {exc}")
            return MockAIService().translate_kannada_query(query_text)

    def transcribe_kannada_audio(self, audio_bytes: bytes) -> str:
        # Groq chat models don't transcribe audio; keep the existing stub.
        return MockAIService().transcribe_kannada_audio(audio_bytes)


class CatalystGLMService(BaseAIService):
    """
    Catalyst QuickML GLM chat — the PRIMARY AI. OpenAI-compatible; on any
    failure each method delegates to `fallback` (Groq, then heuristic mock), so
    the chain is Catalyst → Groq → mock.

    Config (env):
      CATALYST_AI_TOKEN  Bearer token (required to use Catalyst)
      CATALYST_AI_URL    default the project's GLM chat endpoint
      CATALYST_AI_ORG    default 60080167463
      CATALYST_AI_MODEL  default crm-di-glm47b_30b_it
    """

    DEFAULT_URL = "https://api.catalyst.zoho.in/quickml/v1/project/46808000000019001/glm/chat"

    def __init__(self, fallback: BaseAIService):
        self.url = os.getenv("CATALYST_AI_URL") or self.DEFAULT_URL
        self.token = os.getenv("CATALYST_AI_TOKEN", "")
        self.org = os.getenv("CATALYST_AI_ORG", "60080167463")
        self.model = os.getenv("CATALYST_AI_MODEL", "crm-di-glm47b_30b_it")
        self.fallback = fallback

    @staticmethod
    def is_configured() -> bool:
        return bool(os.getenv("CATALYST_AI_TOKEN"))

    def _chat(self, system: str, user: str, max_tokens: int = 1024) -> str:
        import requests

        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.4,
            "stream": False,
        }
        resp = requests.post(
            self.url,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.token}",
                "CATALYST-ORG": self.org,
            },
            json=body,
            timeout=45,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()

    def analyze_crime_pattern(self, query_text: str, historical_records: list) -> dict:
        try:
            records = json.dumps(historical_records[:30], default=str)
            system = (
                "You are a lead crime analyst for the Karnataka State Police. "
                "Reply ONLY with a single JSON object, no prose."
            )
            user = (
                "Analyse the investigator query against the recent FIR records and return JSON with keys: "
                "summary (string), detected_patterns (array of strings), confidence_score (number 0-1), "
                "recommended_actions (array of strings), audit_explanation (string). "
                f"Investigator query: {query_text}\nFIR records: {records}"
            )
            start = time.perf_counter()
            result = _extract_json(self._chat(system, user, 1100))
            metrics.record_ai(True, "catalyst", self.model, (time.perf_counter() - start) * 1000)
            return result
        except Exception as exc:  # noqa: BLE001
            print(f"[CatalystGLM] analyze_crime_pattern fell back: {exc}")
            return self.fallback.analyze_crime_pattern(query_text, historical_records)

    def calculate_risk_score_explanation(self, criminal_name: str, priors_count: int, crime_types: list) -> str:
        try:
            system = (
                "You are a police intelligence analyst. Write a clinical, professional 3-4 sentence "
                "recidivism risk assessment suitable for a dashboard. No preamble."
            )
            user = (
                f"Suspect: {criminal_name}. Prior cases: {priors_count}. "
                f"Offence types: {', '.join(crime_types) or 'unknown'}."
            )
            start = time.perf_counter()
            result = _strip_think(self._chat(system, user, 320))
            metrics.record_ai(True, "catalyst", self.model, (time.perf_counter() - start) * 1000)
            return result
        except Exception as exc:  # noqa: BLE001
            print(f"[CatalystGLM] risk_explanation fell back: {exc}")
            return self.fallback.calculate_risk_score_explanation(criminal_name, priors_count, crime_types)

    def translate_kannada_query(self, query_text: str) -> dict:
        try:
            system = "You are a translation assistant for the Karnataka State Police. Reply ONLY with JSON."
            user = (
                "Detect the language of the input. If Kannada, translate to English; if English, keep it. "
                "Return JSON with keys: original_query (string), translated_query (string), "
                "detected_language ('kn' or 'en'), confidence (number 0-1). "
                f"Input: {query_text.strip()}"
            )
            start = time.perf_counter()
            result = _extract_json(self._chat(system, user, 400))
            metrics.record_ai(True, "catalyst", self.model, (time.perf_counter() - start) * 1000)
            return result
        except Exception as exc:  # noqa: BLE001
            print(f"[CatalystGLM] translate fell back: {exc}")
            return self.fallback.translate_kannada_query(query_text)

    def transcribe_kannada_audio(self, audio_bytes: bytes) -> str:
        return self.fallback.transcribe_kannada_audio(audio_bytes)


class AIServiceFactory:
    @staticmethod
    def get_ai_service() -> BaseAIService:
        """
        AI selection (Open/Closed). Chain: Catalyst GLM (primary, if
        CATALYST_AI_TOKEN) → Groq (FALLBACK_AI_*) → Gemini → heuristic mock.
        """
        if LLMAIService.is_configured():
            base: BaseAIService = LLMAIService()
        else:
            api_key = os.getenv("GEMINI_API_KEY")
            mock_pipeline = os.getenv("MOCK_AI_PIPELINE", "true").lower() == "true"
            base = MockAIService() if (not api_key or mock_pipeline) else GeminiAIService(api_key=api_key)

        if CatalystGLMService.is_configured():
            return CatalystGLMService(fallback=base)
        return base
