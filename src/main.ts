import { lektionen } from 'virtual:lektionen';

const app = document.getElementById('app')!;
app.innerHTML = `<h1>Voci-Trainer</h1><ul>${lektionen
  .map((l) => `<li>${l.name} (${l.sprache}) – ${l.eintraege.length} Einträge</li>`)
  .join('')}</ul>`;
