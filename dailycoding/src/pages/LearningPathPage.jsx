import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const TIER_COLOR = {
  bronze: '#cd7f32',
  silver: '#a8a9ad',
  gold: '#ffd700',
  platinum: '#00b4d8',
  emerald: '#50fa7b',
  diamond: '#a8e6ff',
  master: '#bc8cff',
  grandmaster: '#ff6b6b',
  challenger: '#f8b739',
  unranked: 'var(--text3)',
};

const LANGUAGE_TRACKS = [
  {
    id: 'python',
    icon: '🐍',
    logo: '/tech/python.png',
    label: 'Python',
    color: { bg: 'rgba(255,212,59,.08)', border: 'rgba(255,212,59,.3)', text: '#d4a900', pill: 'rgba(255,212,59,.15)' },
    desc: '파이썬으로 알고리즘의 기초를 배워보세요. 문법이 간결해 초보자에게 가장 추천하는 언어입니다.',
    levels: [
      {
        id: 'python-lv1',
        title: '🌱 입문',
        subtitle: '기본 문법 · 입출력 · 조건/반복문',
        problems: [
          { id: 1001, title: 'A+B', tier: 'bronze' },
          { id: 1002, title: '사칙연산', tier: 'bronze' },
          { id: 1004, title: '홀짝 구분', tier: 'bronze' },
          { id: 1006, title: '팩토리얼', tier: 'bronze' },
          { id: 1007, title: '문자열 뒤집기', tier: 'bronze' },
          { id: 1008, title: '자릿수 합', tier: 'bronze' },
          { id: 1011, title: '절댓값 차이', tier: 'bronze' },
          { id: 1014, title: '평균 구하기', tier: 'bronze' },
          { id: 1016, title: '직사각형 넓이', tier: 'bronze' },
          { id: 1019, title: '문자열 길이', tier: 'bronze' },
          { id: 1022, title: '큰 수 출력', tier: 'bronze' },
          { id: 5010, title: '회문', tier: 'bronze' },
        ],
      },
      {
        id: 'python-lv2',
        title: '📘 기초',
        subtitle: '리스트 · 딕셔너리 · 수학',
        problems: [
          { id: 1003, title: '피보나치 수', tier: 'bronze' },
          { id: 1005, title: '최댓값 구하기', tier: 'bronze' },
          { id: 1009, title: '약수의 개수', tier: 'bronze' },
          { id: 1010, title: '최솟값 구하기', tier: 'bronze' },
          { id: 1012, title: '모음 개수', tier: 'bronze' },
          { id: 1015, title: '배열 합', tier: 'bronze' },
          { id: 1017, title: '회문 문자열', tier: 'bronze' },
          { id: 1018, title: '삼각수', tier: 'bronze' },
          { id: 1021, title: '짝수 개수', tier: 'bronze' },
          { id: 1023, title: '최대공약수', tier: 'bronze' },
          { id: 1024, title: '최소공배수', tier: 'bronze' },
          { id: 1025, title: '배열 속 소수 개수', tier: 'bronze' },
        ],
      },
      {
        id: 'python-lv3',
        title: '⚡ 중급',
        subtitle: '정렬 · 탐색 · DP 입문',
        problems: [
          { id: 2001, title: '계단 오르기', tier: 'silver' },
          { id: 2002, title: '가장 긴 증가하는 부분 수열', tier: 'silver' },
          { id: 2003, title: '소수 찾기', tier: 'silver' },
          { id: 2005, title: '이진 탐색', tier: 'silver' },
          { id: 2007, title: '구간 합 질의', tier: 'silver' },
          { id: 2009, title: '두 수 쌍 개수', tier: 'silver' },
          { id: 2015, title: '최빈값', tier: 'silver' },
          { id: 2016, title: '최대 부분합', tier: 'silver' },
          { id: 5001, title: '최대 부분 배열 합', tier: 'silver' },
          { id: 5003, title: '단어 뒤집기 3', tier: 'silver' },
          { id: 5007, title: '안전 영역 2', tier: 'silver' },
          { id: 5009, title: '구간 합 구하기 4', tier: 'silver' },
        ],
      },
      {
        id: 'python-lv4',
        title: '🔥 심화',
        subtitle: '그래프 · DP · 고급 알고리즘',
        problems: [
          { id: 2004, title: 'BFS', tier: 'silver' },
          { id: 2013, title: 'DFS 연결 요소', tier: 'silver' },
          { id: 3001, title: '최단경로', tier: 'gold' },
          { id: 3004, title: '배낭 문제', tier: 'gold' },
          { id: 3008, title: 'LCS 길이', tier: 'gold' },
          { id: 3010, title: '최소 동전 개수', tier: 'gold' },
          { id: 3011, title: '회의실 배정', tier: 'gold' },
          { id: 3012, title: '미로 최단 경로', tier: 'gold' },
          { id: 5002, title: '최소 동전 개수 2', tier: 'gold' },
          { id: 5006, title: '카드 합치기', tier: 'gold' },
          { id: 5008, title: '내리막 길 2', tier: 'gold' },
          { id: 4001, title: '문자열 압축', tier: 'platinum' },
        ],
      },
    ],
  },
  {
    id: 'javascript',
    icon: '🟨',
    logo: '/tech/javascript.webp',
    label: 'JavaScript',
    color: { bg: 'rgba(247,223,30,.08)', border: 'rgba(247,223,30,.3)', text: '#c9a800', pill: 'rgba(247,223,30,.15)' },
    desc: '웹의 언어 자바스크립트로 알고리즘 실력과 웹 개발 역량을 동시에 키워보세요.',
    levels: [
      {
        id: 'js-lv1',
        title: '🌱 입문',
        subtitle: '변수 · 함수 · 기본 연산',
        problems: [
          { id: 1001, title: 'A+B', tier: 'bronze' },
          { id: 1002, title: '사칙연산', tier: 'bronze' },
          { id: 1004, title: '홀짝 구분', tier: 'bronze' },
          { id: 1006, title: '팩토리얼', tier: 'bronze' },
          { id: 1007, title: '문자열 뒤집기', tier: 'bronze' },
          { id: 1013, title: '대문자 변환', tier: 'bronze' },
          { id: 1019, title: '문자열 길이', tier: 'bronze' },
          { id: 1021, title: '짝수 개수', tier: 'bronze' },
          { id: 1022, title: '큰 수 출력', tier: 'bronze' },
          { id: 1026, title: '문자열 숫자 합', tier: 'bronze' },
          { id: 5010, title: '회문', tier: 'bronze' },
        ],
      },
      {
        id: 'js-lv2',
        title: '📘 기초',
        subtitle: '배열 · 객체 · 함수형 패턴',
        problems: [
          { id: 1003, title: '피보나치 수', tier: 'bronze' },
          { id: 1005, title: '최댓값 구하기', tier: 'bronze' },
          { id: 1008, title: '자릿수 합', tier: 'bronze' },
          { id: 1010, title: '최솟값 구하기', tier: 'bronze' },
          { id: 1012, title: '모음 개수', tier: 'bronze' },
          { id: 1014, title: '평균 구하기', tier: 'bronze' },
          { id: 1015, title: '배열 합', tier: 'bronze' },
          { id: 1017, title: '회문 문자열', tier: 'bronze' },
          { id: 1018, title: '삼각수', tier: 'bronze' },
          { id: 1023, title: '최대공약수', tier: 'bronze' },
          { id: 1025, title: '배열 속 소수 개수', tier: 'bronze' },
        ],
      },
      {
        id: 'js-lv3',
        title: '⚡ 중급',
        subtitle: '스택 · 큐 · 해시맵',
        problems: [
          { id: 2006, title: '괄호 검사', tier: 'silver' },
          { id: 2007, title: '구간 합 질의', tier: 'silver' },
          { id: 2009, title: '두 수 쌍 개수', tier: 'silver' },
          { id: 2014, title: '요세푸스 마지막 수', tier: 'silver' },
          { id: 2015, title: '최빈값', tier: 'silver' },
          { id: 2018, title: '큐 시뮬레이션', tier: 'silver' },
          { id: 2019, title: '중앙값 찾기', tier: 'silver' },
          { id: 2021, title: '서로 다른 문자 수', tier: 'silver' },
          { id: 5001, title: '최대 부분 배열 합', tier: 'silver' },
          { id: 5003, title: '단어 뒤집기 3', tier: 'silver' },
          { id: 5005, title: '트리 부모 찾기 2', tier: 'silver' },
        ],
      },
      {
        id: 'js-lv4',
        title: '🔥 심화',
        subtitle: 'BFS/DFS · DP · 고급',
        problems: [
          { id: 2001, title: '계단 오르기', tier: 'silver' },
          { id: 2002, title: '가장 긴 증가하는 부분 수열', tier: 'silver' },
          { id: 2003, title: '소수 찾기', tier: 'silver' },
          { id: 2004, title: 'BFS', tier: 'silver' },
          { id: 2013, title: 'DFS 연결 요소', tier: 'silver' },
          { id: 3001, title: '최단경로', tier: 'gold' },
          { id: 3004, title: '배낭 문제', tier: 'gold' },
          { id: 3012, title: '미로 최단 경로', tier: 'gold' },
          { id: 5004, title: '가장 큰 정사각형 2', tier: 'gold' },
          { id: 4001, title: '문자열 압축', tier: 'platinum' },
          { id: 4002, title: 'KMP 찾기', tier: 'platinum' },
        ],
      },
    ],
  },
  {
    id: 'java',
    icon: '☕',
    logo: '/tech/java.webp',
    label: 'Java',
    color: { bg: 'rgba(234,91,32,.08)', border: 'rgba(234,91,32,.3)', text: '#ea5b20', pill: 'rgba(234,91,32,.15)' },
    desc: '객체지향 프로그래밍의 정석 Java로 탄탄한 기초를 쌓으세요. 취업 코딩테스트 1위 언어입니다.',
    levels: [
      {
        id: 'java-lv1',
        title: '🌱 입문',
        subtitle: '기본 문법 · 클래스 · 타입',
        problems: [
          { id: 1001, title: 'A+B', tier: 'bronze' },
          { id: 1002, title: '사칙연산', tier: 'bronze' },
          { id: 1003, title: '피보나치 수', tier: 'bronze' },
          { id: 1004, title: '홀짝 구분', tier: 'bronze' },
          { id: 1006, title: '팩토리얼', tier: 'bronze' },
          { id: 1008, title: '자릿수 합', tier: 'bronze' },
          { id: 1011, title: '절댓값 차이', tier: 'bronze' },
          { id: 1016, title: '직사각형 넓이', tier: 'bronze' },
          { id: 1018, title: '삼각수', tier: 'bronze' },
          { id: 1020, title: '배열 범위', tier: 'bronze' },
        ],
      },
      {
        id: 'java-lv2',
        title: '📘 기초',
        subtitle: 'ArrayList · HashMap · Stack · Queue',
        problems: [
          { id: 1005, title: '최댓값 구하기', tier: 'bronze' },
          { id: 1009, title: '약수의 개수', tier: 'bronze' },
          { id: 1010, title: '최솟값 구하기', tier: 'bronze' },
          { id: 1014, title: '평균 구하기', tier: 'bronze' },
          { id: 1015, title: '배열 합', tier: 'bronze' },
          { id: 1023, title: '최대공약수', tier: 'bronze' },
          { id: 1024, title: '최소공배수', tier: 'bronze' },
          { id: 2006, title: '괄호 검사', tier: 'silver' },
          { id: 2014, title: '요세푸스 마지막 수', tier: 'silver' },
          { id: 2015, title: '최빈값', tier: 'silver' },
          { id: 2018, title: '큐 시뮬레이션', tier: 'silver' },
        ],
      },
      {
        id: 'java-lv3',
        title: '⚡ 중급',
        subtitle: '정렬 · 탐색 · 재귀',
        problems: [
          { id: 2001, title: '계단 오르기', tier: 'silver' },
          { id: 2002, title: '가장 긴 증가하는 부분 수열', tier: 'silver' },
          { id: 2003, title: '소수 찾기', tier: 'silver' },
          { id: 2005, title: '이진 탐색', tier: 'silver' },
          { id: 2009, title: '두 수 쌍 개수', tier: 'silver' },
          { id: 2012, title: '좌표 압축', tier: 'silver' },
          { id: 2016, title: '최대 부분합', tier: 'silver' },
          { id: 5001, title: '최대 부분 배열 합', tier: 'silver' },
          { id: 5005, title: '트리 부모 찾기 2', tier: 'silver' },
          { id: 5007, title: '안전 영역 2', tier: 'silver' },
        ],
      },
      {
        id: 'java-lv4',
        title: '🔥 심화',
        subtitle: '그래프 · DP · 고급 자료구조',
        problems: [
          { id: 2004, title: 'BFS', tier: 'silver' },
          { id: 2013, title: 'DFS 연결 요소', tier: 'silver' },
          { id: 3001, title: '최단경로', tier: 'gold' },
          { id: 3003, title: '위상 정렬', tier: 'gold' },
          { id: 3004, title: '배낭 문제', tier: 'gold' },
          { id: 3007, title: '최소 스패닝 트리', tier: 'gold' },
          { id: 3008, title: 'LCS 길이', tier: 'gold' },
          { id: 3009, title: '유니온 파인드 질의', tier: 'gold' },
          { id: 4003, title: '세그먼트 트리 합 질의', tier: 'platinum' },
          { id: 4004, title: 'LCA', tier: 'platinum' },
        ],
      },
    ],
  },
  {
    id: 'c',
    icon: '🔵',
    logo: '/tech/c.png',
    label: 'C언어',
    color: { bg: 'rgba(88,166,255,.08)', border: 'rgba(88,166,255,.3)', text: '#58a6ff', pill: 'rgba(88,166,255,.15)' },
    desc: '컴퓨터 과학의 뿌리 C언어로 메모리 구조와 포인터까지 깊이 이해하세요.',
    levels: [
      {
        id: 'c-lv1',
        title: '🌱 입문',
        subtitle: 'printf/scanf · 변수 · 연산자',
        problems: [
          { id: 1001, title: 'A+B', tier: 'bronze' },
          { id: 1002, title: '사칙연산', tier: 'bronze' },
          { id: 1004, title: '홀짝 구분', tier: 'bronze' },
          { id: 1006, title: '팩토리얼', tier: 'bronze' },
          { id: 1008, title: '자릿수 합', tier: 'bronze' },
          { id: 1009, title: '약수의 개수', tier: 'bronze' },
          { id: 1011, title: '절댓값 차이', tier: 'bronze' },
          { id: 1014, title: '평균 구하기', tier: 'bronze' },
          { id: 1016, title: '직사각형 넓이', tier: 'bronze' },
          { id: 1018, title: '삼각수', tier: 'bronze' },
          { id: 1022, title: '큰 수 출력', tier: 'bronze' },
        ],
      },
      {
        id: 'c-lv2',
        title: '📘 기초',
        subtitle: '배열 · 포인터 · 문자열',
        problems: [
          { id: 1003, title: '피보나치 수', tier: 'bronze' },
          { id: 1005, title: '최댓값 구하기', tier: 'bronze' },
          { id: 1007, title: '문자열 뒤집기', tier: 'bronze' },
          { id: 1010, title: '최솟값 구하기', tier: 'bronze' },
          { id: 1012, title: '모음 개수', tier: 'bronze' },
          { id: 1013, title: '대문자 변환', tier: 'bronze' },
          { id: 1015, title: '배열 합', tier: 'bronze' },
          { id: 1017, title: '회문 문자열', tier: 'bronze' },
          { id: 1020, title: '배열 범위', tier: 'bronze' },
          { id: 1023, title: '최대공약수', tier: 'bronze' },
          { id: 1024, title: '최소공배수', tier: 'bronze' },
        ],
      },
      {
        id: 'c-lv3',
        title: '⚡ 중급',
        subtitle: '구조체 · 동적 메모리 · 알고리즘',
        problems: [
          { id: 1025, title: '배열 속 소수 개수', tier: 'bronze' },
          { id: 2001, title: '계단 오르기', tier: 'silver' },
          { id: 2003, title: '소수 찾기', tier: 'silver' },
          { id: 2005, title: '이진 탐색', tier: 'silver' },
          { id: 2006, title: '괄호 검사', tier: 'silver' },
          { id: 2014, title: '요세푸스 마지막 수', tier: 'silver' },
          { id: 2016, title: '최대 부분합', tier: 'silver' },
          { id: 2018, title: '큐 시뮬레이션', tier: 'silver' },
          { id: 5001, title: '최대 부분 배열 합', tier: 'silver' },
          { id: 5009, title: '구간 합 구하기 4', tier: 'silver' },
        ],
      },
      {
        id: 'c-lv4',
        title: '🔥 심화',
        subtitle: '그래프 · DP · 고급 알고리즘',
        problems: [
          { id: 2004, title: 'BFS', tier: 'silver' },
          { id: 2013, title: 'DFS 연결 요소', tier: 'silver' },
          { id: 3001, title: '최단경로', tier: 'gold' },
          { id: 3004, title: '배낭 문제', tier: 'gold' },
          { id: 3007, title: '최소 스패닝 트리', tier: 'gold' },
          { id: 3010, title: '최소 동전 개수', tier: 'gold' },
          { id: 3012, title: '미로 최단 경로', tier: 'gold' },
          { id: 5002, title: '최소 동전 개수 2', tier: 'gold' },
          { id: 5004, title: '가장 큰 정사각형 2', tier: 'gold' },
          { id: 4001, title: '문자열 압축', tier: 'platinum' },
        ],
      },
    ],
  },
  {
    id: 'cpp',
    icon: '⚙️',
    logo: '/tech/cpp.png',
    label: 'C++',
    color: { bg: 'rgba(86,211,100,.08)', border: 'rgba(86,211,100,.3)', text: '#56d364', pill: 'rgba(86,211,100,.15)' },
    desc: 'STL과 고성능 알고리즘의 강자 C++로 코딩 대회와 실전 개발까지 대비하세요.',
    levels: [
      {
        id: 'cpp-lv1',
        title: '🌱 입문',
        subtitle: 'cin/cout · vector · string',
        problems: [
          { id: 1001, title: 'A+B', tier: 'bronze' },
          { id: 1002, title: '사칙연산', tier: 'bronze' },
          { id: 1004, title: '홀짝 구분', tier: 'bronze' },
          { id: 1007, title: '문자열 뒤집기', tier: 'bronze' },
          { id: 1008, title: '자릿수 합', tier: 'bronze' },
          { id: 1012, title: '모음 개수', tier: 'bronze' },
          { id: 1013, title: '대문자 변환', tier: 'bronze' },
          { id: 1016, title: '직사각형 넓이', tier: 'bronze' },
          { id: 1019, title: '문자열 길이', tier: 'bronze' },
          { id: 1021, title: '짝수 개수', tier: 'bronze' },
        ],
      },
      {
        id: 'cpp-lv2',
        title: '📘 기초',
        subtitle: 'vector · map · set · stack · queue',
        problems: [
          { id: 1003, title: '피보나치 수', tier: 'bronze' },
          { id: 1005, title: '최댓값 구하기', tier: 'bronze' },
          { id: 1009, title: '약수의 개수', tier: 'bronze' },
          { id: 1010, title: '최솟값 구하기', tier: 'bronze' },
          { id: 1023, title: '최대공약수', tier: 'bronze' },
          { id: 1024, title: '최소공배수', tier: 'bronze' },
          { id: 2006, title: '괄호 검사', tier: 'silver' },
          { id: 2014, title: '요세푸스 마지막 수', tier: 'silver' },
          { id: 2018, title: '큐 시뮬레이션', tier: 'silver' },
          { id: 2019, title: '중앙값 찾기', tier: 'silver' },
          { id: 2023, title: '배열 최대공약수', tier: 'silver' },
        ],
      },
      {
        id: 'cpp-lv3',
        title: '⚡ 중급',
        subtitle: 'sort · binary_search · 그래프 탐색',
        problems: [
          { id: 2001, title: '계단 오르기', tier: 'silver' },
          { id: 2002, title: '가장 긴 증가하는 부분 수열', tier: 'silver' },
          { id: 2003, title: '소수 찾기', tier: 'silver' },
          { id: 2004, title: 'BFS', tier: 'silver' },
          { id: 2005, title: '이진 탐색', tier: 'silver' },
          { id: 2009, title: '두 수 쌍 개수', tier: 'silver' },
          { id: 2010, title: '슬라이딩 윈도우 최대 합', tier: 'silver' },
          { id: 2012, title: '좌표 압축', tier: 'silver' },
          { id: 2013, title: 'DFS 연결 요소', tier: 'silver' },
          { id: 5007, title: '안전 영역 2', tier: 'silver' },
        ],
      },
      {
        id: 'cpp-lv4',
        title: '🔥 심화',
        subtitle: '세그먼트 트리 · KMP · 위상 정렬',
        problems: [
          { id: 3001, title: '최단경로', tier: 'gold' },
          { id: 3003, title: '위상 정렬', tier: 'gold' },
          { id: 3004, title: '배낭 문제', tier: 'gold' },
          { id: 3005, title: '트리의 지름', tier: 'gold' },
          { id: 3007, title: '최소 스패닝 트리', tier: 'gold' },
          { id: 3009, title: '유니온 파인드 질의', tier: 'gold' },
          { id: 4001, title: '문자열 압축', tier: 'platinum' },
          { id: 4002, title: 'KMP 찾기', tier: 'platinum' },
          { id: 4003, title: '세그먼트 트리 합 질의', tier: 'platinum' },
          { id: 4004, title: 'LCA', tier: 'platinum' },
        ],
      },
    ],
  },
];

const ALGO_TRACKS = [
  {
    id: 'data-structure',
    icon: '🗃️',
    label: '자료구조',
    color: { bg: 'rgba(188,140,255,.08)', border: 'rgba(188,140,255,.3)', text: '#bc8cff', pill: 'rgba(188,140,255,.15)' },
    desc: '스택, 큐, 트리, 그래프 — 알고리즘의 뼈대를 이루는 자료구조들을 단계별로 마스터하세요.',
    levels: [
      {
        id: 'ds-lv1',
        title: '🌱 선형 자료구조',
        subtitle: '배열 · 스택 · 큐',
        problems: [
          { id: 1005, title: '최댓값 구하기', tier: 'bronze' },
          { id: 1010, title: '최솟값 구하기', tier: 'bronze' },
          { id: 1015, title: '배열 합', tier: 'bronze' },
          { id: 1020, title: '배열 범위', tier: 'bronze' },
          { id: 2006, title: '괄호 검사', tier: 'silver' },
          { id: 2014, title: '요세푸스 마지막 수', tier: 'silver' },
          { id: 2018, title: '큐 시뮬레이션', tier: 'silver' },
          { id: 2019, title: '중앙값 찾기', tier: 'silver' },
          { id: 5003, title: '단어 뒤집기 3', tier: 'silver' },
          { id: 5009, title: '구간 합 구하기 4', tier: 'silver' },
        ],
      },
      {
        id: 'ds-lv2',
        title: '📘 해시 · 집합',
        subtitle: '해시맵 · 집합 · 우선순위 큐',
        problems: [
          { id: 2009, title: '두 수 쌍 개수', tier: 'silver' },
          { id: 2015, title: '최빈값', tier: 'silver' },
          { id: 2021, title: '서로 다른 문자 수', tier: 'silver' },
          { id: 2023, title: '배열 최대공약수', tier: 'silver' },
          { id: 2024, title: '가장 큰 짝수', tier: 'silver' },
          { id: 3011, title: '회의실 배정', tier: 'gold' },
          { id: 5001, title: '최대 부분 배열 합', tier: 'silver' },
          { id: 5006, title: '카드 합치기', tier: 'gold' },
        ],
      },
      {
        id: 'ds-lv3',
        title: '⚡ 트리',
        subtitle: '이진트리 · 힙 · 세그먼트 트리',
        problems: [
          { id: 3005, title: '트리의 지름', tier: 'gold' },
          { id: 3009, title: '유니온 파인드 질의', tier: 'gold' },
          { id: 4003, title: '세그먼트 트리 합 질의', tier: 'platinum' },
          { id: 4004, title: 'LCA', tier: 'platinum' },
          { id: 5005, title: '트리 부모 찾기 2', tier: 'silver' },
        ],
      },
      {
        id: 'ds-lv4',
        title: '🔥 고급 자료구조',
        subtitle: 'Union-Find · 네트워크 플로우',
        problems: [
          { id: 3002, title: '네트워크 플로우', tier: 'gold' },
          { id: 3007, title: '최소 스패닝 트리', tier: 'gold' },
          { id: 4005, title: '최장 팰린드롬 부분문자열', tier: 'diamond' },
          { id: 4007, title: '벽 한 번 부수고 이동', tier: 'diamond' },
        ],
      },
    ],
  },
  {
    id: 'dp',
    icon: '💡',
    label: '동적 프로그래밍',
    color: { bg: 'rgba(255,166,87,.08)', border: 'rgba(255,166,87,.3)', text: '#ffa657', pill: 'rgba(255,166,87,.15)' },
    desc: '복잡한 문제를 작은 부분 문제로 나누어 해결하는 DP를 마스터하세요.',
    levels: [
      {
        id: 'dp-lv1',
        title: '🌱 1차원 DP',
        subtitle: '피보나치 · 계단 · 최대 부분합',
        problems: [
          { id: 1003, title: '피보나치 수', tier: 'bronze' },
          { id: 2001, title: '계단 오르기', tier: 'silver' },
          { id: 2002, title: '가장 긴 증가하는 부분 수열', tier: 'silver' },
          { id: 2016, title: '최대 부분합', tier: 'silver' },
          { id: 5001, title: '최대 부분 배열 합', tier: 'silver' },
          { id: 5009, title: '구간 합 구하기 4', tier: 'silver' },
        ],
      },
      {
        id: 'dp-lv2',
        title: '📘 2차원 DP',
        subtitle: 'LCS · 배낭 · 행렬 경로',
        problems: [
          { id: 3004, title: '배낭 문제', tier: 'gold' },
          { id: 3006, title: '2차원 구간 합', tier: 'gold' },
          { id: 3008, title: 'LCS 길이', tier: 'gold' },
          { id: 5004, title: '가장 큰 정사각형 2', tier: 'gold' },
          { id: 5008, title: '내리막 길 2', tier: 'gold' },
          { id: 4006, title: '편집 거리', tier: 'diamond' },
        ],
      },
      {
        id: 'dp-lv3',
        title: '⚡ DP 최적화',
        subtitle: '동전 · 메모이제이션 · 경로',
        problems: [
          { id: 3010, title: '최소 동전 개수', tier: 'gold' },
          { id: 3012, title: '미로 최단 경로', tier: 'gold' },
          { id: 5002, title: '최소 동전 개수 2', tier: 'gold' },
          { id: 5006, title: '카드 합치기', tier: 'gold' },
          { id: 4008, title: '외판원 순회', tier: 'diamond' },
        ],
      },
    ],
  },
  {
    id: 'graph',
    icon: '🕸️',
    label: '그래프 이론',
    color: { bg: 'rgba(255,122,143,.08)', border: 'rgba(255,122,143,.3)', text: '#ff7a8f', pill: 'rgba(255,122,143,.15)' },
    desc: 'BFS, DFS부터 최단경로, 최소신장트리까지 그래프 이론을 완파하세요.',
    levels: [
      {
        id: 'graph-lv1',
        title: '🌱 탐색',
        subtitle: 'BFS · DFS · 연결 요소',
        problems: [
          { id: 2004, title: 'BFS', tier: 'silver' },
          { id: 2013, title: 'DFS 연결 요소', tier: 'silver' },
          { id: 3012, title: '미로 최단 경로', tier: 'gold' },
          { id: 5007, title: '안전 영역 2', tier: 'silver' },
        ],
      },
      {
        id: 'graph-lv2',
        title: '📘 최단경로',
        subtitle: '다익스트라 · BFS 최단경로',
        problems: [
          { id: 3001, title: '최단경로', tier: 'gold' },
          { id: 3012, title: '미로 최단 경로', tier: 'gold' },
          { id: 4007, title: '벽 한 번 부수고 이동', tier: 'diamond' },
        ],
      },
      {
        id: 'graph-lv3',
        title: '⚡ 고급 그래프',
        subtitle: 'MST · 위상 정렬 · 플로우 · Union-Find',
        problems: [
          { id: 3002, title: '네트워크 플로우', tier: 'gold' },
          { id: 3003, title: '위상 정렬', tier: 'gold' },
          { id: 3005, title: '트리의 지름', tier: 'gold' },
          { id: 3007, title: '최소 스패닝 트리', tier: 'gold' },
          { id: 3009, title: '유니온 파인드 질의', tier: 'gold' },
          { id: 4004, title: 'LCA', tier: 'platinum' },
          { id: 5005, title: '트리 부모 찾기 2', tier: 'silver' },
        ],
      },
    ],
  },
  {
    id: 'sorting',
    icon: '📊',
    label: '정렬 · 탐색',
    color: { bg: 'rgba(86,211,100,.08)', border: 'rgba(86,211,100,.3)', text: '#56d364', pill: 'rgba(86,211,100,.15)' },
    desc: '효율적인 정렬과 탐색 알고리즘으로 코딩테스트의 기본기를 다지세요.',
    levels: [
      {
        id: 'sort-lv1',
        title: '🌱 기본 정렬',
        subtitle: '정렬 응용 · 통계',
        problems: [
          { id: 2015, title: '최빈값', tier: 'silver' },
          { id: 2019, title: '중앙값 찾기', tier: 'silver' },
          { id: 2020, title: '행 최대 합', tier: 'silver' },
          { id: 2024, title: '가장 큰 짝수', tier: 'silver' },
          { id: 3011, title: '회의실 배정', tier: 'gold' },
        ],
      },
      {
        id: 'sort-lv2',
        title: '📘 이진 탐색',
        subtitle: '이진탐색 · 투포인터 · 슬라이딩 윈도우',
        problems: [
          { id: 2005, title: '이진 탐색', tier: 'silver' },
          { id: 2007, title: '구간 합 질의', tier: 'silver' },
          { id: 2009, title: '두 수 쌍 개수', tier: 'silver' },
          { id: 2010, title: '슬라이딩 윈도우 최대 합', tier: 'silver' },
          { id: 2012, title: '좌표 압축', tier: 'silver' },
          { id: 5009, title: '구간 합 구하기 4', tier: 'silver' },
        ],
      },
    ],
  },
  {
    id: 'string',
    icon: '🔤',
    label: '문자열',
    color: { bg: 'rgba(88,166,255,.08)', border: 'rgba(88,166,255,.3)', text: '#58a6ff', pill: 'rgba(88,166,255,.15)' },
    desc: '문자열 처리부터 KMP까지 문자열 알고리즘을 정복하세요.',
    levels: [
      {
        id: 'str-lv1',
        title: '🌱 기본 문자열',
        subtitle: '역순 · 회문 · 대소문자 변환',
        problems: [
          { id: 1007, title: '문자열 뒤집기', tier: 'bronze' },
          { id: 1012, title: '모음 개수', tier: 'bronze' },
          { id: 1013, title: '대문자 변환', tier: 'bronze' },
          { id: 1017, title: '회문 문자열', tier: 'bronze' },
          { id: 1019, title: '문자열 길이', tier: 'bronze' },
          { id: 1026, title: '문자열 숫자 합', tier: 'bronze' },
          { id: 5010, title: '회문', tier: 'bronze' },
          { id: 2017, title: '공통 문자 수', tier: 'silver' },
          { id: 2021, title: '서로 다른 문자 수', tier: 'silver' },
          { id: 2022, title: '대소문자 반전', tier: 'silver' },
        ],
      },
      {
        id: 'str-lv2',
        title: '📘 문자열 알고리즘',
        subtitle: '압축 · 패턴 매칭 · 편집 거리',
        problems: [
          { id: 5003, title: '단어 뒤집기 3', tier: 'silver' },
          { id: 4001, title: '문자열 압축', tier: 'platinum' },
          { id: 4002, title: 'KMP 찾기', tier: 'platinum' },
          { id: 4005, title: '최장 팰린드롬 부분문자열', tier: 'diamond' },
          { id: 4006, title: '편집 거리', tier: 'diamond' },
        ],
      },
    ],
  },
];

const ALL_TRACKS = [...LANGUAGE_TRACKS, ...ALGO_TRACKS];

export default function LearningPathPage() {
  const navigate = useNavigate();
  const { solved } = useApp();
  const [selectedTrackId, setSelectedTrackId] = useState(LANGUAGE_TRACKS[0].id);
  const [selectedLevelIdx, setSelectedLevelIdx] = useState(0);

  const track = ALL_TRACKS.find(t => t.id === selectedTrackId) || ALL_TRACKS[0];
  const level = track.levels[selectedLevelIdx] || track.levels[0];

  const handleTrackSelect = (id) => {
    setSelectedTrackId(id);
    setSelectedLevelIdx(0);
  };

  const totalProblems = track.levels.reduce((acc, lv) => acc + lv.problems.length, 0);
  const solvedInTrack = track.levels.reduce(
    (acc, lv) => acc + lv.problems.filter(p => Boolean(solved[p.id])).length,
    0
  );
  const solvedInLevel = level.problems.filter(p => Boolean(solved[p.id])).length;

  return (
    <div style={{ padding: '24px 20px 60px', maxWidth: 860, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🎓 학습 트랙</h1>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          언어별 · 주제별 단계적 알고리즘 학습
        </div>
      </div>

      {/* 트랙 탭 바 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 1, marginBottom: 8 }}>
          언어별 트랙
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {LANGUAGE_TRACKS.map(t => {
            const isActive = selectedTrackId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTrackSelect(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                  border: `1px solid ${isActive ? t.color.border : 'var(--border)'}`,
                  background: isActive ? t.color.bg : 'var(--bg2)',
                  color: isActive ? t.color.text : 'var(--text2)',
                  cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
                }}
              >
                {t.logo
                  ? <img src={t.logo} width={16} height={16} alt={t.label} style={{ objectFit: 'contain', flexShrink: 0 }} />
                  : <span>{t.icon}</span>
                }
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 1, marginBottom: 8 }}>
          알고리즘 · 주제별 트랙
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALGO_TRACKS.map(t => {
            const isActive = selectedTrackId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTrackSelect(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                  border: `1px solid ${isActive ? t.color.border : 'var(--border)'}`,
                  background: isActive ? t.color.bg : 'var(--bg2)',
                  color: isActive ? t.color.text : 'var(--text2)',
                  cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 트랙 정보 카드 */}
      <div style={{
        borderRadius: 14, border: `1px solid ${track.color.border}`,
        background: track.color.bg, padding: '16px 18px', marginBottom: 16,
        display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: track.color.pill,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, flexShrink: 0,
        }}>
          {track.logo
            ? <img src={track.logo} width={28} height={28} alt={track.label} style={{ objectFit: 'contain' }} />
            : <span>{track.icon}</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>
            {track.label}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 8 }}>
            {track.desc}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              전체 {totalProblems}문제 · 완료 {solvedInTrack}문제
            </span>
            <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, maxWidth: 120 }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${totalProblems > 0 ? Math.round(solvedInTrack / totalProblems * 100) : 0}%`,
                background: track.color.text, transition: 'width .4s',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* 레벨 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {track.levels.map((lv, i) => {
          const isActive = selectedLevelIdx === i;
          const lvSolved = lv.problems.filter(p => Boolean(solved[p.id])).length;
          return (
            <button
              key={lv.id}
              onClick={() => setSelectedLevelIdx(i)}
              style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                border: `1px solid ${isActive ? track.color.border : 'var(--border)'}`,
                background: isActive ? track.color.pill : 'var(--bg2)',
                color: isActive ? track.color.text : 'var(--text2)',
                cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {lv.title}
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: isActive ? track.color.text : 'var(--text3)',
                opacity: 0.8,
              }}>
                {lvSolved}/{lv.problems.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* 레벨 설명 + 문제 목록 */}
      <div style={{
        borderRadius: 12, border: '1px solid var(--border)',
        background: 'var(--bg2)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{level.subtitle}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {solvedInLevel}/{level.problems.length} 완료
          </span>
        </div>

        {/* 진행률 바 */}
        <div style={{ height: 3, background: 'var(--bg3)' }}>
          <div style={{
            height: '100%',
            width: `${level.problems.length > 0 ? Math.round(solvedInLevel / level.problems.length * 100) : 0}%`,
            background: track.color.text, transition: 'width .4s ease',
          }} />
        </div>

        <div style={{ padding: '10px 12px', display: 'grid', gap: 5 }}>
          {level.problems.map((problem, pIndex) => {
            const isSolved = Boolean(solved[problem.id]);
            return (
              <button
                key={problem.id}
                onClick={() => navigate(`/problems/${problem.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8,
                  border: `1px solid ${isSolved ? 'rgba(86,211,100,.25)' : 'var(--border)'}`,
                  background: isSolved ? 'rgba(86,211,100,.06)' : 'var(--bg3)',
                  color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
                  transition: 'background .15s, border-color .15s', fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: isSolved ? 'var(--green)' : 'var(--bg2)',
                  border: `1px solid ${isSolved ? 'var(--green)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800,
                  color: isSolved ? '#0d1117' : 'var(--text3)',
                }}>
                  {isSolved ? '✓' : pIndex + 1}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{problem.title}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: TIER_COLOR[problem.tier] || 'var(--text3)',
                  textTransform: 'capitalize',
                }}>
                  {problem.tier}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
