/**
 * Favori « Envoyer à PilePoil » : sur la fiche d'un produit ouverte dans le navigateur, lit le nom et la marque
 * (données structurées schema.org) et le tableau des caractéristiques (ouvert d'un clic s'il est replié), puis ouvre
 * PilePoil sur #/import/<texte>. Le texte est après le #, jamais envoyé à un serveur. Ni prix ni photo : le prix
 * affiché ne dit pas toujours ce qu'il paie (m², carton), il se saisit dans l'application.
 */

/** Code exécuté sur la page du magasin ; `__APP__` est remplacé par l'adresse de l'application. */
const SOURCE = `(async()=>{
const q=s=>[...document.querySelectorAll(s)];
const rows=()=>q('tr').map(r=>[...r.querySelectorAll('th,td')].map(c=>c.innerText.trim())).filter(c=>c.length===2&&c[0]&&c[1]).map(c=>c[0]+'\\t'+c[1]).concat(q('dt').filter(d=>d.nextElementSibling&&d.nextElementSibling.tagName==='DD').map(d=>d.innerText.trim()+'\\t'+d.nextElementSibling.innerText.trim()));
let t=rows();
if(t.length<3){const b=q('button,a,summary,[role=tab]').find(e=>/caract[ée]ristiques/i.test(e.textContent||''));if(b){b.click();await new Promise(r=>setTimeout(r,1500));t=rows();}}
const ld=q('script[type="application/ld+json"]').flatMap(s=>{try{const j=JSON.parse(s.textContent);return [].concat(j,j['@graph']||[]);}catch(e){return [];}}).find(x=>x&&x['@type']==='Product');
const brand=ld&&ld.brand?(ld.brand.name||ld.brand):'';
const o=[(ld&&ld.name)||document.title,brand?'Marque\\t'+brand:''].concat(t).filter(Boolean).join('\\n').slice(0,6000);
window.open(__APP__+'#/import/'+encodeURIComponent(o),'_blank');
})()`;

/** Adresse `javascript:` du favori, pour l'application publiée à `appUrl` (sans #). */
export function bookmarklet(appUrl: string): string {
  const code = SOURCE.replace('__APP__', JSON.stringify(appUrl)).replace(/\n/g, '');
  return 'javascript:' + encodeURIComponent(code);
}
