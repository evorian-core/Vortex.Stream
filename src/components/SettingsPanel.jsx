
import React, { useEffect, useState } from "react";
import {
  ArrowLeft, Palette, Type, UserRound, MonitorPlay,
  ShieldCheck, FileText, Info, Check, Trash2, Sun, Moon,
  Monitor, ChevronRight, RotateCcw
} from "lucide-react";
import "./settings.css";

const DEFAULTS = {
  theme: "dark",
  accent: "violet",
  font: "modern",
  fontSize: "normal",
  language: "pt-BR",
  autoplay: true,
  animations: true,
  reduceMotion: false,
  profileName: "",
  kidsMode: false,
  captions: false,
  preferredQuality: "auto",
};

const STORAGE_KEY = "vortex.preferences.v3";

const NAVIGATION = [
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "typography", label: "Fontes e leitura", icon: Type },
  { id: "profile", label: "Perfil", icon: UserRound },
  { id: "playback", label: "Reprodução", icon: MonitorPlay },
  { id: "privacy", label: "Privacidade", icon: ShieldCheck },
  { id: "legal", label: "Termos e políticas", icon: FileText },
  { id: "about", label: "Sobre o VORTEX", icon: Info },
];

function loadPreferences() {
  try {
    return {
      ...DEFAULTS,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function SettingRow({ title, description, children }) {
  return (
    <div className="v-setting-row">
      <div className="v-setting-copy">
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      <div className="v-setting-control">{children}</div>
    </div>
  );
}

function Choice({ value, selected, onClick, children }) {
  return (
    <button
      type="button"
      className={`v-choice ${selected ? "is-selected" : ""}`}
      aria-pressed={selected}
      onClick={() => onClick(value)}
    >
      {children}
      {selected && <Check size={15} />}
    </button>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`v-toggle ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export default function SettingsPanel({
  onBack,
  profile,
  onSaveProfile,
}) {
  const [settings, setSettings] = useState(loadPreferences);
  const [activeSection, setActiveSection] = useState("appearance");
  const [saved, setSaved] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.vortexTheme = settings.theme;
    document.documentElement.dataset.vortexAccent = settings.accent;
    document.documentElement.dataset.vortexFont = settings.font;
    document.documentElement.dataset.vortexFontSize = settings.fontSize;
    document.documentElement.dataset.vortexMotion =
      settings.reduceMotion ? "reduced" : "normal";

    if (settings.theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: light)");
      document.documentElement.dataset.vortexResolvedTheme =
        media.matches ? "light" : "dark";
    } else {
      document.documentElement.dataset.vortexResolvedTheme = settings.theme;
    }
  }, [settings]);

  function update(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    onSaveProfile?.({
      name: settings.profileName,
      kidsMode: settings.kidsMode,
    });
    setSaved(true);
  }

  function reset() {
    setSettings({ ...DEFAULTS, profileName: profile?.name || "" });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...DEFAULTS,
      profileName: profile?.name || "",
    }));
    setShowReset(false);
    setSaved(true);
  }

  const active = NAVIGATION.find((item) => item.id === activeSection);

  return (
    <main className="v-settings-page">
      <header className="v-settings-header">
        <button className="v-back-button" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>Voltar</span>
        </button>

        <div>
          <span className="v-settings-eyebrow">VORTEX / PREFERÊNCIAS</span>
          <h1>Configurações</h1>
          <p>Personalize sua experiência.</p>
        </div>

        <button className="v-save-button" onClick={save}>
          <Check size={16} />
          {saved ? "Salvo" : "Salvar alterações"}
        </button>
      </header>

      <div className="v-settings-layout">
        <aside className="v-settings-sidebar">
          <div className="v-settings-sidebar-title">PREFERÊNCIAS</div>

          {NAVIGATION.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`v-settings-nav ${
                activeSection === id ? "is-active" : ""
              }`}
              onClick={() => setActiveSection(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={15} className="v-nav-chevron" />
            </button>
          ))}

          <div className="v-settings-sidebar-footer">
            As alterações são aplicadas à interface.
          </div>
        </aside>

        <section className="v-settings-content">
          <div className="v-settings-section-heading">
            <span className="v-section-icon">
              {active && <active.icon size={21} />}
            </span>
            <div>
              <h2>{active?.label}</h2>
              <p>Configure suas preferências do VORTEX.</p>
            </div>
          </div>

          {activeSection === "appearance" && (
            <div className="v-settings-card">
              <h3>Tema da interface</h3>
              <p className="v-settings-description">
                Escolha como o VORTEX deve aparecer.
              </p>

              <div className="v-theme-grid">
                {[
                  { id: "dark", label: "Escuro", Icon: Moon },
                  { id: "light", label: "Claro", Icon: Sun },
                  { id: "system", label: "Sistema", Icon: Monitor },
                ].map(({ id, label, Icon }) => (
                  <Choice
                    key={id}
                    value={id}
                    selected={settings.theme === id}
                    onClick={(value) => update("theme", value)}
                  >
                    <div className={`v-theme-preview theme-${id}`}>
                      <span />
                      <i />
                      <i />
                    </div>
                    <span className="v-theme-label">
                      <Icon size={16} />
                      {label}
                    </span>
                  </Choice>
                ))}
              </div>

              <div className="v-settings-divider" />

              <h3>Cor de destaque</h3>
              <p className="v-settings-description">
                Usada em botões, seleções e indicadores.
              </p>

              <div className="v-accent-options">
                {[
                  ["violet", "Violeta", "#7857ff"],
                  ["blue", "Azul", "#3288ff"],
                  ["cyan", "Ciano", "#16c8d8"],
                  ["red", "Vermelho", "#f04452"],
                  ["green", "Verde", "#28ba88"],
                ].map(([id, label, color]) => (
                  <button
                    key={id}
                    className={`v-accent-option ${
                      settings.accent === id ? "is-selected" : ""
                    }`}
                    onClick={() => update("accent", id)}
                    aria-label={`Cor ${label}`}
                    aria-pressed={settings.accent === id}
                  >
                    <span style={{ background: color }} />
                    {label}
                    {settings.accent === id && <Check size={14} />}
                  </button>
                ))}
              </div>

              <SettingRow
                title="Animações da interface"
                description="Transições suaves entre páginas e elementos."
              >
                <Toggle
                  checked={settings.animations}
                  onChange={(value) => update("animations", value)}
                  label="Animações da interface"
                />
              </SettingRow>

              <SettingRow
                title="Reduzir movimento"
                description="Reduz efeitos animados para maior conforto."
              >
                <Toggle
                  checked={settings.reduceMotion}
                  onChange={(value) => update("reduceMotion", value)}
                  label="Reduzir movimento"
                />
              </SettingRow>
            </div>
          )}

          {activeSection === "typography" && (
            <div className="v-settings-card">
              <h3>Estilo tipográfico</h3>
              <p className="v-settings-description">
                Escolha a personalidade visual dos textos.
              </p>

              {[
                ["modern", "Moderna", "Inter, system-ui, sans-serif"],
                ["classic", "Clássica", "Georgia, serif"],
                ["technical", "Geométrica", "Trebuchet MS, sans-serif"],
                ["system", "Padrão do sistema", "system-ui, sans-serif"],
              ].map(([id, label, family]) => (
                <Choice
                  key={id}
                  value={id}
                  selected={settings.font === id}
                  onClick={(value) => update("font", value)}
                >
                  <span className={`v-font-sample font-${id}`}>
                    <strong>{label}</strong>
                    <small>A história começa aqui.</small>
                  </span>
                </Choice>
              ))}

              <div className="v-settings-divider" />

              <h3>Tamanho do texto</h3>
              <div className="v-choice-row">
                {[
                  ["small", "Pequeno"],
                  ["normal", "Normal"],
                  ["large", "Grande"],
                ].map(([id, label]) => (
                  <Choice
                    key={id}
                    value={id}
                    selected={settings.fontSize === id}
                    onClick={(value) => update("fontSize", value)}
                  >
                    {label}
                  </Choice>
                ))}
              </div>
            </div>
          )}

          {activeSection === "profile" && (
            <div className="v-settings-card">
              <h3>Seu perfil</h3>
              <p className="v-settings-description">
                Personalize a experiência deste perfil.
              </p>

              <div className="v-profile-preview">
                <div className="v-profile-avatar">
                  {(profile?.name || settings.profileName || "V")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
                <div>
                  <strong>{settings.profileName || profile?.name || "Meu perfil"}</strong>
                  <p>Perfil ativo</p>
                </div>
              </div>

              <label className="v-field-label" htmlFor="v-profile-name">
                Nome do perfil
              </label>
              <input
                id="v-profile-name"
                className="v-text-field"
                value={settings.profileName}
                onChange={(e) => update("profileName", e.target.value)}
                placeholder="Como devemos chamar você?"
                maxLength={40}
              />

              <SettingRow
                title="Perfil infantil"
                description="Preferência visual para um perfil infantil. Isso não substitui filtros de conteúdo no servidor."
              >
                <Toggle
                  checked={settings.kidsMode}
                  onChange={(value) => update("kidsMode", value)}
                  label="Perfil infantil"
                />
              </SettingRow>

              <p className="v-inline-note">
                A galeria de avatares pode ser conectada à coleção de personagens
                quando ela estiver disponível no projeto.
              </p>
            </div>
          )}

          {activeSection === "playback" && (
            <div className="v-settings-card">
              <h3>Preferências de reprodução</h3>
              <p className="v-settings-description">
                Defina como você prefere assistir.
              </p>

              <SettingRow
                title="Reprodução automática"
                description="Reproduzir o próximo episódio quando o player oferecer suporte."
              >
                <Toggle
                  checked={settings.autoplay}
                  onChange={(value) => update("autoplay", value)}
                  label="Reprodução automática"
                />
              </SettingRow>

              <SettingRow
                title="Legendas preferidas"
                description="Solicitar legendas quando disponíveis no player."
              >
                <Toggle
                  checked={settings.captions}
                  onChange={(value) => update("captions", value)}
                  label="Legendas preferidas"
                />
              </SettingRow>

              <label className="v-field-label" htmlFor="v-quality">
                Qualidade preferida
              </label>
              <select
                id="v-quality"
                className="v-select-field"
                value={settings.preferredQuality}
                onChange={(e) => update("preferredQuality", e.target.value)}
              >
                <option value="auto">Automática</option>
                <option value="1080">1080p — se disponível</option>
                <option value="720">720p — se disponível</option>
                <option value="480">480p — se disponível</option>
              </select>

              <p className="v-inline-note">
                Estas opções registram suas preferências. O player externo pode
                não permitir controlar qualidade, legendas ou reprodução automática.
              </p>
            </div>
          )}

          {activeSection === "privacy" && (
            <div className="v-settings-card">
              <h3>Privacidade e dados</h3>
              <p className="v-settings-description">
                Entenda o que esta interface armazena neste dispositivo.
              </p>

              <div className="v-privacy-info">
                <ShieldCheck size={22} />
                <div>
                  <strong>Preferências locais</strong>
                  <p>
                    Tema, fonte e outras opções desta tela ficam no armazenamento
                    local do navegador.
                  </p>
                </div>
              </div>

              <div className="v-privacy-info">
                <MonitorPlay size={22} />
                <div>
                  <strong>Histórico de reprodução</strong>
                  <p>
                    O projeto também possui um histórico local separado. Limpar
                    preferências não apaga automaticamente esse histórico.
                  </p>
                </div>
              </div>

              <button
                className="v-danger-button"
                onClick={() => setShowPrivacy(true)}
              >
                <Trash2 size={16} />
                Apagar preferências locais
              </button>

              <p className="v-inline-note">
                Esta ação apaga apenas as preferências guardadas por esta tela.
                Não exclui conta, dados remotos nem o histórico de reprodução.
              </p>
            </div>
          )}

          {activeSection === "legal" && (
            <div className="v-settings-card">
              <h3>Termos e políticas</h3>
              <p className="v-settings-description">
                Consulte os documentos legais disponibilizados pelo serviço.
              </p>

              <button
                className="v-legal-link"
                onClick={() => setShowPrivacy(true)}
              >
                <div>
                  <strong>Política de Privacidade</strong>
                  <p>Tratamento, armazenamento e exclusão de dados.</p>
                </div>
                <ChevronRight size={18} />
              </button>

              <div className="v-settings-divider" />

              <div className="v-legal-link v-legal-static">
                <div>
                  <strong>Termos de Uso</strong>
                  <p>
                    O endereço oficial dos termos deve ser configurado pelo
                    responsável pelo serviço antes da publicação.
                  </p>
                </div>
                <FileText size={18} />
              </div>

              <div className="v-legal-warning">
                Não publique uma política genérica como se fosse o documento
                jurídico definitivo. Ela precisa refletir as práticas reais
                do VORTEX e os serviços utilizados.
              </div>
            </div>
          )}

          {activeSection === "about" && (
            <div className="v-settings-card">
              <div className="v-about-brand">
                <img src="/logo-v.png" alt="" onError={(e) => {
                  e.currentTarget.style.display = "none";
                }} />
                <div>
                  <h3>VORTEX</h3>
                  <p>Histórias que ficam com você.</p>
                </div>
              </div>

              <SettingRow title="Versão da interface" description="VORTEX 3.0" />
              <SettingRow title="Idioma" description="Português brasileiro" />

              <div className="v-settings-divider" />

              <button
                className="v-reset-button"
                onClick={() => setShowReset(true)}
              >
                <RotateCcw size={16} />
                Restaurar configurações padrão
              </button>
            </div>
          )}

          <div className="v-settings-bottom">
            <span>{saved ? "Alterações salvas neste dispositivo." : "Lembre-se de salvar suas alterações."}</span>
            <button className="v-save-button" onClick={save}>
              <Check size={16} />
              Salvar
            </button>
          </div>
        </section>
      </div>

      {showPrivacy && (
        <div className="v-dialog-backdrop" role="presentation">
          <section className="v-dialog" role="dialog" aria-modal="true" aria-labelledby="v-privacy-title">
            <h2 id="v-privacy-title">Apagar preferências locais?</h2>
            <p>
              O tema, a tipografia e as preferências desta tela serão removidos.
              Seu histórico de reprodução e dados da conta não serão apagados.
            </p>
            <div className="v-dialog-actions">
              <button className="v-reset-button" onClick={() => setShowPrivacy(false)}>
                Cancelar
              </button>
              <button
                className="v-danger-button"
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY);
                  setSettings({ ...DEFAULTS, profileName: profile?.name || "" });
                  setShowPrivacy(false);
                  setSaved(true);
                }}
              >
                Apagar preferências
              </button>
            </div>
          </section>
        </div>
      )}

      {showReset && (
        <div className="v-dialog-backdrop" role="presentation">
          <section className="v-dialog" role="dialog" aria-modal="true" aria-labelledby="v-reset-title">
            <h2 id="v-reset-title">Restaurar padrão?</h2>
            <p>As preferências visuais e de reprodução voltarão aos valores padrão.</p>
            <div className="v-dialog-actions">
              <button className="v-reset-button" onClick={() => setShowReset(false)}>
                Cancelar
              </button>
              <button className="v-save-button" onClick={reset}>
                Restaurar
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
