'use strict';System.register(['../modal','./render','./models','../../vendor/underscore','../options','lang'],function(_export,_context){var BannerModal,renderContents,optionModels,each,find,options,importConfigs;return {setters:[function(_modal){BannerModal=_modal.BannerModal;},function(_render){renderContents=_render.default;},function(_models){optionModels=_models.default;},function(_vendorUnderscore){each=_vendorUnderscore.each;find=_vendorUnderscore.find;},function(_options){options=_options.default;},function(_lang){importConfigs=_lang.importConfigs;}],execute:function(){class OptionsPanel extends BannerModal{constructor(){super({id:'options-panel'});this.onClick({'.tab_link':'switchTab','#export':'exportConfigs','#import':'importConfigs','#hidden':'clearHidden'});this.onAll('change','applyChange');}render(){this.el.innerHTML=renderContents();this.assignValues();this.hidden=this.el.query('#hidden');}assignValues(){for(let id in optionModels){const model=optionModels[id],el=this.el.query('#'+id);const type=model.type;const val=model.get();if(type==='checkbox'){el.checked=val;}else if(type==='number'||type instanceof Array){el.value=val;}else if(type==='shortcut'){el.value=String.fromCharCode(val).toUpperCase();}}}switchTab(event){event.preventDefault();const el=event.target;each(this.el.children,el => el.query('.tab_sel').classList.remove('tab_sel'));el.classList.add('tab_sel');find(this.el.lastChild.children,li => li.classList.contains(el.getAttribute('data-content'))).classList.add('tab_sel');}applyChange(event){const el=event.target,id=el.getAttribute('id'),model=optionModels[id];let val;switch(model.type){case 'checkbox':val=el.checked;break;case 'number':val=parseInt(el.value);break;case 'shortcut':val=el.value.toUpperCase().charCodeAt(0);break;default:val=el.value;}if(!model.validate(val)){el.value='';}else {options.set(id,val);}}exportConfigs(){const a=document.getElementById('export');a.setAttribute('href',window.URL.createObjectURL(new Blob([JSON.stringify(localStorage)],{type:'octet/stream'})));a.setAttribute('download','meguca-config.json');}importConfigs(event){event.preventDefault();const el=document.query('#importSettings');el.click();util.once(el,'change',() => {var reader=new FileReader();reader.readAsText(input.files[0]);reader.onload=event => {let json;try{json=JSON.parse(event.target.result);}catch(err){alert(importConfigs.corrupt);return;}localStorage.clear();for(let key in json){localStorage[key]=json[key];}alert(importConfigs.corrupt);location.reload();};});}renderHidden(count){const el=this.hidden;el.textContent=el.textContent.replace(/\d+$/,count);}clearHidden(){main.request('hide:clear');this.renderHidden(0);}}_export('default',OptionsPanel);(function(){if(localStorage.optionsSeen){return;}const el=document.query('#options');el.style.opacity=1;let out=true,clicked;el.addEventListener("click",() => {clicked=true;localStorage.optionsSeen=1;});tick();function tick(){if(clicked){el.style.opacity=1;return;}el.style.opacity=+el.style.opacity+(out?-0.02:0.02);const now=+el.style.opacity;if(out&&now<=0||!out&&now>=1){out=!out;}requestAnimationFrame(tick);}})();}};});
//# sourceMappingURL=../maps/options/view.js.map
