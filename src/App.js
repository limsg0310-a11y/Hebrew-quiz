
Creating an optimized production build...
Failed to compile.

./src/App.js
SyntaxError: C:\Users\USER\OneDrive\바탕 화면\HebrewQuiz\Hebrew-quiz-main\Hebrew-quiz-main\src\App.js: Missing semicolon. (896:809)

  894 |                 </div>
  895 |                 {currentBook==="hebrew"&&<div style={{display:"flex",gap:"4px",flexWrap:"wrap",marginBottom:"8px"}}>{WORD_TYPES.map(wt=><button key={wt.id} onClick={()=>setNewWordType(t=>t===wt.id?null:wt.id)} style={{...Bt.ghost,padding:"4px 9px",fontSize:"0.7rem",...(newWordType===wt.id?{background:"rgba(232,74,95,0.1)",borderColor:"rgba(232,74,95,0.4)",color:TA}:{})}}>{wt.emoji} {wt.label[uiLang]||wt.label.ko}</button>)}</div>}
> 896 |                 {wallets.length>0&&editId===null&&<div style={{marginBottom:"8px"}}><div style={{fontSize:"0.58rem",color:TD,marginBottom:"4px",letterSpacing:"0.8px",textTransform:"uppercase"}}>{T.addToWordbook}</div><div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>{wallets.map(wl=>{const sel=newWordWallets.has(wl.id);return<button key={wl.id} onClick={()=>setNewWordWallets(s=>{const n=new Set(s);sel?n.delete(wl.id):n.add(wl.id);return n;})} style={{padding:"3px 9px",borderRadius:"2px",fontSize:"0.7rem",cursor:"pointer",border:"1px solid",background:sel?`${wl.color}10`:"transparent",borderColor:sel?`${wl.color}50`:TL,color:sel?wl.color:TD}}><span style={{width:"5px",height:"5px",borderRadius:"50%",background:wl.color,display:"inline-block",marginRight:"4px"}}/>{wl.name}{sel?" ✓":""}</button>);})</div></div>}
      |                                                          
                                                                 
                                                                 
                                                                 
                                                                 
                                                                 
                                                                 
                                                                 
                                                                 
                                                                 
                                                                 
                                                                 
                                     ^
  897 |                 <div style={{display:"flex",gap:"6px"}}> 
  898 |                   <button style={{...Bt.primary,flex:1}} onClick={addWord}>{editId!==null?(uiLang==="en"?T.editBtn:"수정  완료"):(uiLang==="en"?T.addBtn:"추가")}</button>
  899 |                   {newHebrew&&<SpeakBtn text={newHebrew} onSpeak={speakOnDemand} muted={muted}/>}


PS C:\Users\USER\OneDrive\바탕 화면\HebrewQuiz\Hebrew-quiz-main\Hebrew-quiz-main>
