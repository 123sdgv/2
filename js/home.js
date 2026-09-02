(()=>{const clock=document.querySelector('#clock');const update=()=>clock.textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});update();setInterval(update,10000)})();
