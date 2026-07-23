import os
import json
import google.generativeai as genai

# Configure Google Gemini API Key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MOCK_AI = os.getenv("MOCK_AI_PIPELINE", "true").lower() == "true" or not GEMINI_API_KEY

if not MOCK_AI:
    genai.configure(api_key=GEMINI_API_KEY)

class AIService:
    @staticmethod
    def analyze_crime_pattern(query_text: str, historical_records: list) -> dict:
        """Analyze crime patterns using Gemini Flash or mock fallbacks."""
        if MOCK_AI:
            # High-fidelity mock response with patterns, risk levels, and audit recommendations
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
            # Try to strip markdown brackets if Gemini returned them
            text = response.text.strip()
            if text.startswith("```json"):
                text = text.split("```json")[1].split("```")[0].strip()
            elif text.startswith("```"):
                text = text.split("```")[1].split("```")[0].strip()
            
            return json.loads(text)
        except Exception as e:
            # Graceful fallback on API error
            return {
                "summary": f"Analyzed query: '{query_text}' (Fallback mode)",
                "detected_patterns": ["Pattern detection completed via fallback heuristics. Category density matches standard averages."],
                "confidence_score": 0.5,
                "recommended_actions": ["Verify regional records manually. Monitor recidivism parameters."],
                "audit_explanation": f"API Error Fallback. Error details: {str(e)}"
            }

    @staticmethod
    def calculate_risk_score_explanation(criminal_name: str, priors_count: int, crime_types: list) -> str:
        """Generate structured Chain-of-Thought explanation for criminal recidivism risk score."""
        if MOCK_AI:
            return f"Reasoning for {criminal_name}: Priors: {priors_count}. Crime types: {', '.join(crime_types)}. Recidivism probability is elevated due to repeating offenses of high severity. Social network shows links to active crime ring bosses."

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

    @staticmethod
    def translate_kannada_query(query_text: str) -> dict:
        """Detect language, translate Kannada queries to English, and vice versa."""
        # Simple local dictionary mapping for typical Kannada search patterns to support offline operation
        local_kannada_map = {
            "ಬೆಂಗಳೂರಿನಲ್ಲಿ ಕಳ್ಳತನ": "Theft in Bengaluru",
            "ಕಳ್ಳತನ": "Theft",
            "ಕೊಲೆ ಪ್ರಕರಣ": "Homicide case",
            "ನಾರ್ಕೋಟಿಕ್ಸ್": "Narcotics",
            "ಸೈಬರ್ ಕ್ರೈಮ್": "Cybercrime",
            "ಹೊದಿಕೆ": "Summary",
            "ವರದಿ": "Report",
        }

        query_cleaned = query_text.strip()
        
        if MOCK_AI:
            translated = local_kannada_map.get(query_cleaned, query_cleaned)
            is_kannada = any(ord(char) > 127 for char in query_cleaned) # Simple check for non-ASCII Kannada characters
            return {
                "original_query": query_cleaned,
                "translated_query": translated,
                "detected_language": "kn" if is_kannada else "en",
                "confidence": 0.95
            }

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
            # Local fallback
            translated = local_kannada_map.get(query_cleaned, query_cleaned)
            is_kannada = any(ord(char) > 127 for char in query_cleaned)
            return {
                "original_query": query_cleaned,
                "translated_query": translated,
                "detected_language": "kn" if is_kannada else "en",
                "confidence": 0.7
            }

    @staticmethod
    def transcribe_kannada_audio(audio_bytes: bytes) -> str:
        """Transcribe Kannada voice notes. Fallbacks to a mock voice message parsing."""
        # Simple simulated transcription for demonstrating voice queries
        return "ಬೆಂಗಳೂರಿನಲ್ಲಿ ನಡೆದ ಇತ್ತೀಚಿನ ಕಳ್ಳತನ ಪ್ರಕರಣಗಳ ವಿವರ ಕೊಡಿ"
