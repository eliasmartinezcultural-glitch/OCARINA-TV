const DEFAULT_SETTINGS={autoplay:false,volume:70,rememberVolume:true,reducedMotion:false};
function readSettings(){try{return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem("ocarinaTVSettings")||"{}")}}catch{return {...DEFAULT_SETTINGS}}}
function saveSettings(next){const s={...readSettings(),...next};localStorage.setItem("ocarinaTVSettings",JSON.stringify(s));return s}
window.OTV_SETTINGS={readSettings,saveSettings};