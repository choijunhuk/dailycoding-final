export default function SkeletonLoader({ rows = 5, type = 'list' }) {
  if (type === 'cards') {
    return (
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
        {Array.from({length:rows}).map((_,i)=>(
          <div key={i} className="card" style={{padding:20,animation:`fadeIn .3s ease ${i*0.05}s both`}}>
            <div className="skeleton-line" style={{width:'60%',height:16,marginBottom:12}}/>
            <div className="skeleton-line" style={{width:'100%',height:12,marginBottom:8}}/>
            <div className="skeleton-line" style={{width:'80%',height:12,marginBottom:12}}/>
            <div style={{display:'flex',gap:8}}>
              <div className="skeleton-line" style={{width:50,height:20,borderRadius:10}}/>
              <div className="skeleton-line" style={{width:50,height:20,borderRadius:10}}/>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {Array.from({length:rows}).map((_,i)=>(
        <div key={i} style={{
          display:'flex',alignItems:'center',gap:16,padding:'14px 18px',
          background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,
          animation:`fadeIn .3s ease ${i*0.05}s both`,
        }}>
          <div className="skeleton-line" style={{width:40,height:14}}/>
          <div style={{flex:1}}>
            <div className="skeleton-line" style={{width:'60%',height:14,marginBottom:6}}/>
            <div className="skeleton-line" style={{width:'30%',height:10}}/>
          </div>
          <div className="skeleton-line" style={{width:60,height:20,borderRadius:10}}/>
          <div className="skeleton-line" style={{width:30,height:14}}/>
        </div>
      ))}
    </div>
  );
}
