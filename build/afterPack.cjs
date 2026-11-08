// Ajusta el ícono y la información de versión del .exe sin usar wine (resedit, JS puro).
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const R = ResEdit.default || ResEdit;
  const name = ctx.packager.platformSpecificBuildOptions.executableName || ctx.packager.appInfo.productFilename;
  const exe = path.join(ctx.appOutDir, `${name}.exe`);
  const data = fs.readFileSync(exe);
  const exeObj = R.NtExecutable.from(data, { ignoreCert: true });
  const res = R.NtExecutableResource.from(exeObj);
  const ico = R.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const groups = R.Resource.IconGroupEntry.fromEntries(res.entries);
  const gid = groups.length ? groups[0].id : 1; const lang = groups.length ? groups[0].lang : 1033;
  R.Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, lang, ico.icons.map((i) => i.data));
  const vi = R.Resource.VersionInfo.fromEntries(res.entries)[0];
  const v = ctx.packager.appInfo.version.split('.').map(Number);
  vi.setFileVersion(v[0], v[1], v[2], 0, 1033);
  vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'Libreta Meteorológica', ProductName: 'Libreta Meteorológica', CompanyName: 'Estación meteorológica',
    InternalName: 'Libreta', OriginalFilename: `${name}.exe`, LegalCopyright: '',
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exeObj);
  fs.writeFileSync(exe, Buffer.from(exeObj.generate()));
  console.log('  • ícono y versión aplicados a', path.basename(exe));
};
