"use strict";System.register([],function(e,t){var n,i,r,o,s,a,u,c,l,m;return{setters:[],execute:function(){n=require("../main"),i=require("./imager"),r=n._,o=n.Backbone,s=n.common,a=n.util,u=n.lang,c=n.oneeSama,l=n.options,m=n.state,module.exports=i.Hidamari.extend({className:"glass",initialize:function(){this.listenTo(this.model,"dispatch",this.redirect)},clientInit:function(){return l.get("anonymise")&&this.anonymise(),this},redirect:function(e){for(var t=arguments.length,n=Array(t>1?t-1:0),i=1;t>i;i++)n[i-1]=arguments[i];this[e].apply(this,n)},updateBody:function(e){this.blockquote||(this.blockquote=this.el.query("blockquote"));var t=this.model.attributes;this.blockquote.innerHTML=c.setModel(t).body(t.body)},renderTime:function(){this.el.query("time").outerHTML=c.time(this.model.get("time"))},renderBacklinks:function(e){this.el.query("small").innerHTML=c.backlinks(e)},fun:function(){},anonymise:function(){this.el.query(".name").innerHTML='<b class="name">'+u.anon+"<b>"},renderName:function(){this.el.query(".name").outerHTML=c.name(this.model.attributes)},renderModerationInfo:function(e){var t=this.getContainer();t.query(".modLog").remove(),t.query("blockquote").before(a.parseDOM(c.modInfo(e)))},getContainer:function(){return this.el.query(".container")},renderBan:function(){var e=this.getContainer();e.query(".banMessage").remove(),e.query("blockquote").after(a.parseDOM(c.banned()))},renderEditing:function(e){var t=this.el;e?t.classList.add("editing"):(t.classList.remove("editing"),t.query("blockquote").normalize())}})}}});
//# sourceMappingURL=../maps/posts/common.js.map
