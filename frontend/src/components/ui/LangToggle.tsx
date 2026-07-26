import { useI18n } from '../../context/LanguageContext';

/** EN | ಕನ್ನಡ segmented switch that flips the whole UI language. */
export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button
        type="button"
        className="lang-toggle__opt"
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        EN
      </button>
      <button
        type="button"
        className="lang-toggle__opt"
        aria-pressed={lang === 'kn'}
        onClick={() => setLang('kn')}
      >
        ಕನ್ನಡ
      </button>
    </div>
  );
}
