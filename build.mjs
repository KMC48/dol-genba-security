import {mkdir,rm,copyFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url)),output=path.join(root,'www');await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const n of ['index.html','style.css','game.js','characters.png','venues.png','security-team.png','.nojekyll'])await copyFile(path.join(root,n),path.join(output,n));console.log('Built www/: 7 web files. Native projects have not been built.');
