import { createContext, useContext } from 'react';

// 판 안인지 — 판(Card) 안의 빈 화면은 유리 판 없이 내용만 그린다(판 안의 판을 겹치지 않게). 홀로 서면 떠 있는 판.
export const InCard = createContext(false);

export const useInCard = () => useContext(InCard);
