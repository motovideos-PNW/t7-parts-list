(function(){
var D=JSON.parse(document.getElementById("data").textContent);
var ORDER=["Wheels/Tires","Windshields","Protection","Hand Guards","Fenders","Luggage","Tank","Tool","Maintenance","Fuel","Camping — Tents","Camping — Quilts","Camping — Sleeping","Camping","Special","Lighting","Displays","Levers","Controls","Comfort","Suspension","Drivetrain","Brakes","Exhaust","Customizations"];
var NEW="Newly Found Items";
var state={filter:"aftermarket",compare:false,q:"",tax:"0"};
try{var s=localStorage.getItem("t7-tax");if(s!==null)state.tax=s}catch(e){}
var $=function(id){return document.getElementById(id)};
var money=function(n){return n.toLocaleString("en-US",{style:"currency",currency:"USD"})};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var isHttp=function(u){return /^https:\/\//.test(u||"")};
var safe=function(u){return isHttp(u)||/^starlink-guide\//.test(u||"")?u:"#"};
var anchor=function(c){return c.replace(/[^a-z]/gi,"")};
var rel=D.meta.affiliates?"noopener noreferrer sponsored":"noopener noreferrer";
var rate=function(){return (parseFloat(state.tax)||0)/100};
function priced(i){
  if(i.price==null)return null;
  var st=D.sites[i.site];
  var ship=st?(i.price>=st.shipping.freeOver?0:st.shipping.flat):0;
  var tax=(i.price+ship)*rate();
  return{ship:ship,tax:tax,total:i.price+ship+tax};
}
function isNew(i){return !!i.foundAt&&Date.now()-new Date(i.foundAt+"T12:00:00").getTime()<14*86400000}
function rank(c){if(c===NEW)return -1;var k=-1;for(var j=0;j<ORDER.length;j++){if(c.indexOf(ORDER[j])===0){k=j;break}}return k<0?99:k}
function groups(){
  var rows=D.items.filter(function(i){
    return(state.filter==="all"||i.type===state.filter)&&(!state.q||(i.name+" "+i.description+" "+i.category+" "+i.site).toLowerCase().indexOf(state.q.toLowerCase())>=0);
  });
  var m={};var keys=[];
  rows.forEach(function(i){var k=isNew(i)?NEW:i.category;if(!m[k]){m[k]=[];keys.push(k)}m[k].push(i)});
  keys.sort(function(a,b){return rank(a)-rank(b)});
  return{rows:rows,list:keys.map(function(k){return[k,m[k]]})};
}
function linkAttrs(u){return isHttp(u)?' target="_blank" rel="'+rel+'"':""}
function itemHtml(i){
  var p=priced(i);var st=D.sites[i.site];
  var img=i.image&&isHttp(i.image)?'<img class="thumb" src="'+esc(i.image)+'" alt="'+esc(i.name)+'" loading="lazy" referrerpolicy="no-referrer">':'<div class="ph"></div>';
  var h='<div class="item"><div class="who">'+img+'<div><div class="nm">'+esc(i.name)+'</div><div class="ds">'+esc(i.description)+'</div>';
  if(i.specs)h+='<div class="sp">'+esc(i.specs)+'</div>';
  if(i.trending)h+='<div class="tr">Why it’s trending: '+esc(i.trending)+'</div>';
  if(i.foundAt)h+='<span class="tag t-new">New '+esc(i.foundAt)+' · '+esc(i.category)+'</span>';
  if(i.fitCheck)h+='<span class="tag t-fit">Confirm 2025 fit</span>';
  h+='<span class="tag '+(i.type==="oem"?"t-oem":"t-am")+'">'+(i.type==="oem"?"OEM":"AfterMarket")+'</span></div></div>';
  h+='<div><div>'+esc(i.site)+'</div><div class="'+(i.inStock?"ok":"out")+'">'+esc(i.stockText)+'</div>';
  h+='<a class="buy" href="'+esc(safe(i.url))+'"'+linkAttrs(i.url)+'>'+(isHttp(i.url)?"View / buy ↗":"Open guide →")+'</a>';
  if(i.promo)h+='<div class="promo">'+esc(i.promo)+'</div>';
  if(i.fitment)h+='<div class="fit">'+esc(i.fitment)+'</div>';
  (i.alsoAt||[]).forEach(function(a){
    h+='<div class="also">Also at <a href="'+esc(safe(a.url))+'"'+linkAttrs(a.url)+'>'+esc(a.site)+'</a> '+(a.price!=null?money(a.price):"(check price)")+(a.note?" — "+esc(a.note):"")+'</div>';
  });
  h+='</div><div>';
  if(p){
    h+='<div class="big">'+(i.priceFrom?"from ":"")+money(p.total)+'</div><div class="small">'+money(i.price)+" + "+(p.ship?money(p.ship):"free")+" ship"+(st&&st.estimated?" (est.)":"")+(rate()>0?" + "+money(p.tax)+" tax":"")+'</div>';
  }else{
    h+='<div class="mut">'+esc(i.priceNote||"Price n/a")+'</div>';
  }
  return h+'</div></div>';
}
function renderList(){
  var g=groups();
  var nav="",out="";
  g.list.forEach(function(e){
    var cat=e[0],items=e[1];
    nav+='<a href="#'+anchor(cat)+'"><span>'+esc(cat)+'</span><span>'+items.length+'</span></a>';
    var shown=items;
    if(state.compare&&cat!==NEW){
      var c=items.filter(function(i){return i.price!=null}).sort(function(a,b){return priced(a).total-priced(b).total})[0];
      shown=c?[c]:[];
    }
    out+='<section class="panel" id="'+anchor(cat)+'"><h2>'+esc(cat)+' <span>('+items.length+')</span></h2>'+shown.map(itemHtml).join("")+'</section>';
  });
  if(!g.rows.length)out='<p class="mut">No items in this filter.</p>';
  $("nav").innerHTML=nav;$("list").innerHTML=out;
}
function sync(){
  [["aftermarket","f-am"],["oem","f-oem"],["all","f-all"]].forEach(function(p){$(p[1]).setAttribute("aria-pressed",String(state.filter===p[0]))});
  $("cmp").setAttribute("aria-pressed",String(state.compare));
}
[["aftermarket","f-am"],["oem","f-oem"],["all","f-all"]].forEach(function(p){$(p[1]).addEventListener("click",function(){state.filter=p[0];sync();renderList()})});
$("cmp").addEventListener("click",function(){state.compare=!state.compare;sync();renderList()});
$("q").addEventListener("input",function(e){state.q=e.target.value;renderList()});
$("tax").value=state.tax;
$("tax").addEventListener("input",function(e){state.tax=e.target.value;try{localStorage.setItem("t7-tax",state.tax)}catch(x){}renderList()});
$("list").addEventListener("error",function(e){if(e.target&&e.target.tagName==="IMG"){var d=document.createElement("div");d.className="ph";e.target.replaceWith(d)}},true);
var up=new Date(D.updatedAt);
$("count").textContent="Updated "+(isNaN(up)?"recently":up.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}))+" · "+D.items.length+" parts · ";
sync();renderList();
})();
