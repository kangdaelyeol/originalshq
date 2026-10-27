

/** 소수부가 있으면 그 부분만 작고 옅게 렌더링해서 정수부가 먼저 읽히도록 한다 —
 * 평균 행은 유일하게 소수가 섞여 나오는 행이라, 그 소수를 "부가 정보"처럼 덜
 * 도드라지게 보여주면 합계·일별 행과 나란히 봐도 자릿수 차이가 덜 거슬린다. */
export function SplitDecimalValue({ text }: { text: string }) {
  const dot = text.lastIndexOf('.')
  if (dot === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, dot)}
      <span className="channel-insight__pivot-avg-decimal">
        {text.slice(dot)}
      </span>
    </>
  )
}
