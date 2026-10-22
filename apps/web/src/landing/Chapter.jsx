/** A title card between scenes, in the manner of a TV-anime episode card: black, white, condensed serif. */
export default function Chapter({no, jp, title, line, tone = ''}) {
  return (
    <section className={`chapter ${tone}`} aria-label={`Chapter ${no}: ${title}`}>
      <div className="wrap ch-in">
        <p className="ch-no rise">第{no}話</p>
        <h2 className="ch-title"><span className="ch-jp" lang="ja">{jp}</span><span className="ch-en chrome-script">{title.charAt(0) + title.slice(1).toLowerCase()}</span></h2>
        <p className="ch-line rise">{line}</p>
      </div>
    </section>
  );
}
