import Link from "next/link";

export default function WelcomePage() {
  return <main className="landing">
    <nav className="landing-nav"><Link href="/welcome" className="brand landing-brand"><span className="brand-mark">C</span><span>CallLens <b>Coach</b></span></Link><div><Link href="/sample-analysis">Sample analysis</Link><Link href="/" className="primary">Open workspace</Link></div></nav>
    <section className="hero"><div className="hero-copy"><span className="eyebrow accent">OPENAI BUILD WEEK · CONTACT CENTER QUALITY</span><h1>The dialect-aware AI QA manager for modern contact centers.</h1><p>CallLens turns English and Arabic calls into evidence-based scores, culturally aware communication insight, and focused coaching that managers and agents can act on.</p><p className="hero-support">Upload a recording. Get timestamped evidence, QA scoring, and focused coaching.</p><div className="hero-actions"><Link href="/analyze" className="primary">Try CallLens Coach</Link><Link href="/sample-analysis" className="secondary">View sample analysis</Link></div><div className="trust-row"><span><i>✓</i> English + Arabic</span><span><i>✓</i> Evidence with every finding</span><span><i>✓</i> Privacy masking</span></div></div>
      <div className="hero-product hero-workspace-preview" aria-label="Miniature CallLens analysis workspace preview">
        <div className="preview-top"><span><i/> SAMPLE · EVIDENCE VERIFIED</span><b>88<small>/100</small></b></div>
        <div className="preview-labels"><span>Egyptian Arabic</span><span>Evidence verified</span><span>Privacy masking on</span></div>
        <div className="preview-waveform" aria-label="Example recording waveform"><span/><i/><em/><b/><span/><i/><em/><b/><span/><i/><em/><b/></div>
        <div className="preview-timeline"><span>00:00</span><i/><span>00:44</span><i className="warning"/><span>01:31</span><i/><span>02:10</span></div>
        <div className="preview-transcript"><span>01:02 · Agent</span><p>“I can see why a duplicate charge would be upsetting.”</p></div>
        <div className="preview-finding-grid"><article><small>FINDING</small><b>Empathy and ownership</b></article><article className="warning"><small>WARNING</small><b>Verification missed</b></article><article><small>COACHING</small><b>Confirm the next step</b></article></div>
      </div>
    </section>
    <section className="problem"><div><span className="eyebrow">THE PROBLEM</span><h2>Most QA tools score the words. Contact centers need the meaning.</h2></div><p>English-only rubrics miss dialect, code-switching, indirect complaints, and culturally specific reassurance. Generic feedback also leaves agents without the exact moment—or better response—they need to improve.</p></section>
    <section className="landing-features"><article><span>01</span><h3>Dialect-aware QA</h3><p>Understand Egyptian, Gulf, Levantine, Modern Standard Arabic, English, and mixed-language conversations in context.</p></article><article><span>02</span><h3>Evidence, not vibes</h3><p>Every major finding carries a transcript quote, speaker, explanation, position, and related scoring category.</p></article><article><span>03</span><h3>Coach the next call</h3><p>Reconstruct weak responses, practice difficult customers, and follow a measurable seven-day coaching plan.</p></article><article><span>04</span><h3>Privacy with humility</h3><p>Mask common sensitive patterns server-side, report what was detected, and clearly communicate the limits of automation.</p></article></section>
    <section className="landing-cta"><span className="eyebrow">READY FOR THE JUDGES</span><h2>Explore the interface now. Connect live AI when the key is ready.</h2><div className="hero-actions"><Link href="/analyze" className="primary">Try CallLens Coach</Link><Link href="/sample-analysis" className="secondary">View sample analysis</Link></div></section>
    <footer><span>CallLens Coach · OpenAI Build Week 2026</span><Link href="/">Dashboard →</Link></footer>
  </main>;
}
