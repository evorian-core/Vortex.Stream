import { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Film,
  LockKeyhole,
  Mail,
  UserRound,
  Loader2,
} from 'lucide-react';

export default function AuthScreen({ onSignIn, onSignUp }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isSignup = mode === 'signup';

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password.length < 10) { setError('Use uma senha com pelo menos 10 caracteres.'); return; }
    setBusy(true);
    try {
      const payload = { email: email.trim().toLowerCase(), password, ...(isSignup ? { name: name.trim() } : {}) };
      await (isSignup ? onSignUp(payload) : onSignIn(payload));
    } catch (err) {
      setError(err?.message || 'Não foi possível concluir. Tente novamente.');
    } finally { setBusy(false); }
  }

  return <main className="auth-screen">
    <div className="auth-art" aria-hidden="true"><div className="auth-art-glow"/><div className="auth-art-word">VORTEX<span>3.0</span></div><div className="auth-art-caption">HISTÓRIAS QUE ATRAVESSAM DIMENSÕES.</div><div className="auth-art-orbit orbit-one"/><div className="auth-art-orbit orbit-two"/></div>
    <section className="auth-panel">
      <a className="auth-brand" href="#inicio" onClick={e=>e.preventDefault()}><span className="brand-symbol">V</span><span>VORTEX</span></a>
      <div className="auth-heading"><span className="section-kicker">SEU PRÓXIMO UNIVERSO COMEÇA AQUI</span><h1>{isSignup ? 'Entre para o universo.' : 'Bom ter você de volta.'}</h1><p>{isSignup ? 'Crie sua conta e comece a construir sua própria experiência.' : 'Entre na sua conta para continuar sua próxima história.'}</p></div>
      <div className="auth-mode-switch"><button type="button" className={!isSignup?'active':''} onClick={()=>{setMode('login');setError('');}}>Entrar</button><button type="button" className={isSignup?'active':''} onClick={()=>{setMode('signup');setError('');}}>Criar conta</button></div>
      <form className="auth-form" onSubmit={submit}>
        {isSignup&&<label><span>Nome</span><div className="auth-input-wrap"><UserRound size={17}/><input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Como devemos chamar você?" maxLength={40} required/></div></label>}
        <label><span>E-mail</span><div className="auth-input-wrap"><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com" required/></div></label>
        <label><span>Senha <small>(mínimo de 10 caracteres)</small></span><div className="auth-input-wrap"><LockKeyhole size={17}/><input type={showPassword?'text':'password'} autoComplete={isSignup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" minLength={10} required/><button type="button" className="auth-show-password" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar senha':'Mostrar senha'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
        {error&&<div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" disabled={busy} type="submit">{busy?<><Loader2 className="auth-spinner" size={18}/> Aguarde…</>:<>{isSignup?'Criar minha conta':'Entrar no VORTEX'} <ArrowRight size={18}/></>}</button>
      </form>
      <p className="auth-legal">Ao continuar, você concorda com os termos de uso e a política de privacidade do VORTEX.</p>
      <div className="auth-security"><LockKeyhole size={14}/><span>Suas credenciais são processadas pelo servidor com senha protegida por hash.</span></div>
      <div className="auth-footer"><Film size={15}/> Uma experiência. Infinitas histórias.</div>
    </section>
  </main>;
}
