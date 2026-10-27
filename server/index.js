import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());
let adapter;
try {
  adapter = await import('./providers/superflixAdapter.js');
  console.log('[VORTEX] SuperFlix + TMDB Adapter carregado');
} catch (e) {
  console.error('[VORTEX] Erro adapter', e);
}
app.get('/api/health', (req,res)=>res.json({ok:true, superflix: process.env.SUPERFLIX_ENABLED==='true'}));
app.get('/api/catalog', async (req,res)=>{
  try{
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const catalog = await adapter.getProviderCatalog({ limit });
    res.json(catalog);
  }catch(e){ console.error(e); res.status(500).json({error:e.message, items:[]}); }
});
app.get('/api/search', async (req,res)=>{
  const q=req.query.q||'';
  if(!q) return res.json([]);
  try{ const results = await adapter.searchProvider(q); res.json(results); }
  catch(e){ console.error(e); res.json([]); }
});
app.get('/api/playback/:id', async (req,res)=>{
  try{ const pb = await adapter.getPlayback(req.params.id); res.json(pb); }
  catch(e){ res.status(500).json({error:e.message}); }
});
app.listen(PORT, ()=> console.log(`[VORTEX] API iniciada na porta ${PORT}; catálogo e playback disponíveis via API pública.`));