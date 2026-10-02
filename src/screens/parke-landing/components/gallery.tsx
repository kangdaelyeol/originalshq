export const Gallery = () => {
  const shots = [
    [
      '/images/premium-v27/gallery-signature.webp',
      '01 / SIGNATURE',
      '빛을 따라 드러나는 조형.',
    ],
    [
      '/images/premium-v27/gallery-detail.webp',
      '02 / DETAIL',
      '가까이 볼수록, 정교하게.',
    ],
    [
      '/images/premium-v27/gallery-dashboard.webp',
      '03 / IN YOUR CAR',
      '당신의 차에, 자연스럽게.',
    ],
  ]
  return (
    <section className="pf-gallery">
      <div className="pf-section-intro">
        <p className="pf-eyebrow">THE NEXT PARKING PLATE</p>
        <h2>
          차세대 주차번호판.
          <br />
          이름은, 파르케.
        </h2>
      </div>
      <div className="pf-gallery-grid">
        {shots.map(([src, tag, title]) => (
          <figure key={tag}>
            <img
              src={src}
              alt={title}
              width={1672}
              height={941}
              loading="lazy"
            />
            <figcaption>
              <small>{tag}</small>
              <span>{title}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
