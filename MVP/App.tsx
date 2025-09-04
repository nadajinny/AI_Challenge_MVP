// App.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';

// ---------------------------------
// Types
// ---------------------------------
type TabKey = 'log' | 'feedback' | 'community' | 'chat';

type Post = {
  id: string;
  author: string;
  content: string;
  likes: number;
  createdAt: string;
  comments: string[];
};

type ChatMsg = {
  id: string;
  from: 'user' | 'bot';
  text: string;
  ts: number;
};

// ---------------------------------
// Mock / Hardcoded Data
// ---------------------------------
const HARD_TIPS_HIGH = ['5분간 호흡 연습(4-4-6 호흡)', '산책 10분: 햇볕 쬐기', '해야 할 일 1개만 끝내기', '메신저 알림 30분 끄기'];
const HARD_TIPS_MED = ['목/어깨 스트레칭 2분', '물 한 컵 마시기', '할 일 목록에서 쉬운 것 1개 처리'];
const HARD_TIPS_LOW = ['현재 페이스 유지하기', '짧은 감사 일기 쓰기'];

const INITIAL_POSTS: Post[] = [
  {
    id: 'p1',
    author: '익명1',
    content: '오늘 회의가 너무 길었어요… 체력이 방전된 느낌.',
    likes: 3,
    createdAt: '2025-09-01 18:22',
    comments: ['고생하셨어요!', '퇴근 후 따뜻한 차 한 잔 추천해요.'],
  },
  {
    id: 'p2',
    author: '익명2',
    content: '출근길 지옥철… 그래도 동료가 커피 사줘서 버팀!',
    likes: 5,
    createdAt: '2025-09-02 08:57',
    comments: ['달달한 게 최고죠 ☕️', '오늘도 화이팅!'],
  },
];

// ---------------------------------
// Small UI Atoms
// ---------------------------------
const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}>
    <Text style={[styles.chipText, selected ? styles.chipTextOn : styles.chipTextOff]}>{label}</Text>
  </TouchableOpacity>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={{ marginTop: 18 }}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={{ marginTop: 8 }}>{children}</View>
  </View>
);

// ---------------------------------
// Stress scoring (hardcoded)
// ---------------------------------
const NEGATIVE_FACTORS = [
  { key: '야근', weight: 20 },
  { key: '갈등', weight: 25 },
  { key: '회의 많음', weight: 15 },
  { key: '통근 지옥', weight: 12 },
  { key: '수면 부족', weight: 22 },
];

const POSITIVE_FACTORS = [
  { key: '운동함', weight: -18 },
  { key: '산책/햇빛', weight: -12 },
  { key: '명상/호흡', weight: -15 },
  { key: '집중 타임', weight: -10 },
];

const KEYWORD_BONUS = [
  { kw: '갈등', delta: 10 },
  { kw: '마감', delta: 8 },
  { kw: '피곤', delta: 6 },
  { kw: '회의', delta: 6 },
  { kw: '지옥철', delta: 5 },
];

const KEYWORD_RELIEF = [
  { kw: '운동', delta: -8 },
  { kw: '산책', delta: -6 },
  { kw: '명상', delta: -7 },
  { kw: '휴식', delta: -5 },
  { kw: '칭찬', delta: -4 },
];

function scoreStress(text: string, selectedNeg: string[], selectedPos: string[]) {
  let score = 50;
  for (const f of NEGATIVE_FACTORS) if (selectedNeg.includes(f.key)) score += f.weight;
  for (const f of POSITIVE_FACTORS) if (selectedPos.includes(f.key)) score += f.weight;

  const lower = text.toLowerCase();
  for (const k of KEYWORD_BONUS) if (lower.includes(k.kw)) score += k.delta;
  for (const k of KEYWORD_RELIEF) if (lower.includes(k.kw)) score += k.delta;

  score += Math.min(10, Math.floor(text.trim().length / 80));
  score = Math.round(Math.max(0, Math.min(100, score)));

  let category = '낮음';
  let msg = '오늘 페이스 좋습니다. 루틴을 유지해요.';
  if (score >= 75) {
    category = '매우 높음';
    msg = '쉬어야 해요. 지금은 속도를 늦추고 회복에 집중하세요.';
  } else if (score >= 60) {
    category = '높음';
    msg = '피로 누적 신호! 작은 휴식과 완급 조절이 필요합니다.';
  } else if (score >= 40) {
    category = '보통';
    msg = '무난하지만 방심 금지. 짧은 스트레칭/물 마시기 권장.';
  }

  return { score, category, msg };
}

// ---------------------------------
// Screens
// ---------------------------------
function StressLogScreen({ onComputed }: { onComputed: (score: number, category: string, msg: string) => void }) {
  const [text, setText] = useState('');
  const [negatives, setNegatives] = useState<string[]>([]);
  const [positives, setPositives] = useState<string[]>([]);
  const [result, setResult] = useState<{ score: number; category: string; msg: string } | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);

  const toggleNeg = (k: string) => setNegatives((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const togglePos = (k: string) => setPositives((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const handleCompute = () => {
    const out = scoreStress(text, negatives, positives);
    setResult(out);
    onComputed(out.score, out.category, out.msg);
  };

  const tipList = useMemo(() => {
    if (!result) return HARD_TIPS_LOW;
    if (result.score >= 75) return HARD_TIPS_HIGH;
    if (result.score >= 60) return HARD_TIPS_MED;
    if (result.score >= 40) return HARD_TIPS_LOW;
    return HARD_TIPS_LOW;
  }, [result]);

  // width 타입 안전
  const progressPct: `${number}%` = `${result ? result.score : 0}%`;

  return (
    <ScrollView contentContainerStyle={styles.screenPad} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>직무 스트레스 기록</Text>

      <Section title="오늘 있었던 일 (간단히 적기)">
        <TextInput
          placeholder="예: 회의 4개, 동료와 의견 충돌… 저녁엔 운동함"
          multiline
          value={text}
          onChangeText={setText}
          style={styles.textArea}
        />
      </Section>

      <Section title="상황 선택 (부정 요인)">
        <View style={styles.rowWrap}>
          {NEGATIVE_FACTORS.map((f) => (
            <Chip key={f.key} label={f.key} selected={negatives.includes(f.key)} onPress={() => toggleNeg(f.key)} />
          ))}
        </View>
      </Section>

      <Section title="완충 요인 (긍정)">
        <View style={styles.rowWrap}>
          {POSITIVE_FACTORS.map((f) => (
            <Chip key={f.key} label={f.key} selected={positives.includes(f.key)} onPress={() => togglePos(f.key)} />
          ))}
        </View>
      </Section>

      <TouchableOpacity onPress={handleCompute} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>스트레스 지수 계산</Text>
      </TouchableOpacity>

      {result && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI 추정 스트레스 지수</Text>
          <View style={styles.progressWrap}>
            <View style={[styles.progressBarBg]} />
            <View style={[styles.progressBarFill, { width: progressPct }]} />
            <Text style={styles.progressText}>{result.score} / 100</Text>
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={styles.badge}>상태: {result.category}</Text>
          </View>
          <Text style={styles.resultMsg}>{result.msg}</Text>

          <View style={styles.rowJustify}>
            <Text style={styles.cardSubtitle}>즉각 가이드</Text>
            <TouchableOpacity onPress={() => setTipsOpen(true)}>
              <Text style={styles.link}>비슷한 상황 팁 보기</Text>
            </TouchableOpacity>
          </View>

          {result.score >= 60 ? (
            <Text style={styles.guideText}>⏰ 지금은 쉬는 신호! 15~20분 집중 끊고 스트레칭/물 마시기 권장.</Text>
          ) : (
            <Text style={styles.guideText}>✅ 페이스 유지! 2시간 뒤 3분 스트레칭 알림(가정).</Text>
          )}
        </View>
      )}

      <Modal visible={tipsOpen} animationType="slide" transparent onRequestClose={() => setTipsOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>비슷한 상황 팁</Text>
            {tipList.map((t, i) => (
              <Text key={i} style={styles.modalItem}>
                • {t}
              </Text>
            ))}
            <TouchableOpacity onPress={() => setTipsOpen(false)} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function FeedbackScreen({ lastScore, lastCategory, lastMsg }: { lastScore: number | null; lastCategory: string | null; lastMsg: string | null }) {
  const tips = useMemo(() => {
    if (lastScore == null) return HARD_TIPS_LOW;
    if (lastScore >= 75) return HARD_TIPS_HIGH;
    if (lastScore >= 60) return HARD_TIPS_MED;
    if (lastScore >= 40) return HARD_TIPS_LOW;
    return HARD_TIPS_LOW;
  }, [lastScore]);

  return (
    <ScrollView contentContainerStyle={styles.screenPad}>
      <Text style={styles.title}>간단 피드백</Text>

      {lastScore == null ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>먼저 기록 화면에서 지수를 계산해 주세요.</Text>
          <Text style={styles.resultMsg}>지수에 따라 즉각 가이드를 보여드립니다.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>최근 결과</Text>
          <Text style={styles.feedbackLine}>지수: {lastScore} / 100</Text>
          <Text style={styles.feedbackLine}>상태: {lastCategory}</Text>
          <Text style={styles.resultMsg}>{lastMsg}</Text>

          <Section title="바로 적용 가능한 한 줄 가이드">
            {lastScore >= 60 ? (
              <Text style={styles.guideText}>🏖️ 10~15분 회복 타임 확보(산책/호흡/차 한 잔).</Text>
            ) : (
              <Text style={styles.guideText}>🧭 페이스 유지 + 90분마다 3분 휴식.</Text>
            )}
          </Section>

          <Section title="추천 팁 (하드코딩)">
            {tips.map((t, i) => (
              <Text key={i} style={styles.modalItem}>
                • {t}
              </Text>
            ))}
          </Section>
        </View>
      )}
    </ScrollView>
  );
}

function CommunityScreen() {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [newPost, setNewPost] = useState('');

  const addPost = () => {
    const content = newPost.trim();
    if (!content) return;
    const now = new Date();
    const p: Post = {
      id: `p-${now.getTime()}`,
      author: '익명',
      content,
      likes: 0,
      createdAt: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      comments: [],
    };
    setPosts((prev) => [p, ...prev]);
    setNewPost('');
  };

  const likePost = (id: string) => setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)));
  const addComment = (id: string, comment: string) => {
    if (!comment.trim()) return;
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, comments: [...p.comments, comment.trim()] } : p)));
  };

  const renderItem = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <Text style={styles.postMeta}>
        {item.author} · {item.createdAt}
      </Text>
      <Text style={styles.postContent}>{item.content}</Text>

      <View style={styles.rowJustify}>
        <TouchableOpacity onPress={() => likePost(item.id)} style={styles.postBtn}>
          <Text style={styles.postBtnText}>🤍 공감 {item.likes}</Text>
        </TouchableOpacity>
        <Text style={styles.postMeta}>댓글 {item.comments.length}</Text>
      </View>

      <CommentBox onSubmit={(c) => addComment(item.id, c)} />

      {item.comments.slice(-3).map((c, idx) => (
        <Text key={idx} style={styles.commentItem}>
          • {c}
        </Text>
      ))}
      {item.comments.length > 3 && <Text style={styles.moreText}>더 보기(하드코딩: 전체 보기 미구현)</Text>}
    </View>
  );

  return (
    <View style={styles.screenPad}>
      <Text style={styles.title}>커뮤니티 (기본)</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>오늘 한 줄 남기기</Text>
        <TextInput placeholder="예: 오늘 나 힘들었다… 그래도 버텼다!" value={newPost} onChangeText={setNewPost} style={styles.input} />
        <TouchableOpacity onPress={addPost} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>올리기</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ---------------------------------
// Chat Screen (NEW)
// ---------------------------------
function ChatScreen({ lastScore, lastCategory }: { lastScore: number | null; lastCategory: string | null }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'm0',
      from: 'bot',
      text: '안녕하세요! 저는 간단한 상담 챗봇이에요. “스트레스 낮추는 팁 알려줘”처럼 물어보세요.',
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList<ChatMsg>>(null);

  const quickReplies = [
    '오늘 너무 피곤해',
    '스트레스 낮추는 팁',
    '호흡법 알려줘',
    '커뮤니티에 글 쓰고 싶어',
  ];

  // 스크롤 맨 아래로
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  const push = (m: ChatMsg) => setMessages((prev) => [...prev, m]);

  const botReplyFor = (userText: string): string => {
    const t = userText.trim().toLowerCase();

    if (/안녕|hello|hi/.test(t)) {
      return '안녕하세요! 오늘 컨디션은 어떤가요? “스트레스 낮추는 팁”이라고 해보세요.';
    }
    if (/호흡|명상|breath|호흡법/.test(t)) {
      return '4-4-6 호흡 추천: 4초 들이마시고, 4초 멈춘 뒤, 6초 내쉬기. 1~3분 반복해보세요.';
    }
    if (/팁|tip|스트레스.*낮|힘들어|피곤/.test(t)) {
      if (lastScore != null) {
        if (lastScore >= 75) return `최근 상태가 “매우 높음”이었어요. 10~15분 회복 타임(산책/호흡) + 알림 끄기를 권장합니다.`;
        if (lastScore >= 60) return `최근 상태가 “높음”이었네요. 물 한 컵 + 5분 스트레칭으로 리셋해볼까요?`;
        return `최근 상태가 “${lastCategory ?? '보통'}” 수준이었어요. 루틴 유지하며 가벼운 산책 어떨까요?`;
      }
      return '짧은 스트레칭 2분 + 물 한 컵부터 시작해보세요. 가능하다면 햇볕 쬐며 5~10분 산책도 좋아요.';
    }
    if (/커뮤니티|글|공유/.test(t)) {
      return '하단 탭의 “커뮤니티”에서 한 줄 글을 남기고 공감을 받아보세요. 가볍게 털어놓는 것만으로도 도움이 돼요.';
    }
    if (/지수|score|상태/.test(t)) {
      if (lastScore == null) return '아직 지수를 계산하지 않으셨어요. “기록” 탭에서 계산해 보시겠어요?';
      return `최근 지수는 ${lastScore}/100, 상태는 “${lastCategory}”였습니다.`;
    }
    return '도움이 될 수 있도록 계속 배우는 중이에요. “호흡법 알려줘”, “스트레스 낮추는 팁”처럼 물어보세요!';
  };

  const handleSend = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text) return;

    const u: ChatMsg = { id: `u-${Date.now()}`, from: 'user', text, ts: Date.now() };
    push(u);
    setInput('');
    setTyping(true);

    // 간단한 타이핑 지연 후 응답 (UI 연출용)
    setTimeout(() => {
      const reply = botReplyFor(text);
      const b: ChatMsg = { id: `b-${Date.now()}`, from: 'bot', text: reply, ts: Date.now() };
      push(b);
      setTyping(false);
    }, 450);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.screenPad}>
        <Text style={styles.title}>상담 챗봇</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={[styles.bubbleRow, item.from === 'user' ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
            <View style={[styles.bubble, item.from === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
              <Text style={styles.bubbleText}>{item.text}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {typing && (
        <View style={[styles.bubbleRow, styles.bubbleRowLeft, { paddingHorizontal: 16 }]}>
          <View style={[styles.bubble, styles.bubbleBot]}>
            <Text style={styles.bubbleText}>…</Text>
          </View>
        </View>
      )}

      {/* Quick Replies */}
      <View style={styles.quickRow}>
        {['오늘 너무 피곤해', '스트레스 낮추는 팁', '호흡법 알려줘', '커뮤니티에 글 쓰고 싶어'].map((q) => (
          <TouchableOpacity key={q} onPress={() => handleSend(q)} style={styles.quickChip}>
            <Text style={styles.quickChipText}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Input Bar */}
      <View style={styles.chatInputRow}>
        <TextInput
          placeholder="메시지를 입력하세요…"
          value={input}
          onChangeText={setInput}
          style={styles.chatInput}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />
        <TouchableOpacity onPress={() => handleSend()} style={styles.chatSendBtn}>
          <Text style={styles.chatSendText}>전송</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentBox({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [v, setV] = useState('');
  return (
    <View style={styles.commentRow}>
      <TextInput placeholder="댓글 쓰기…" value={v} onChangeText={setV} style={styles.commentInput} />
      <TouchableOpacity
        onPress={() => {
          onSubmit(v);
          setV('');
        }}
        style={styles.commentSend}
      >
        <Text style={styles.commentSendText}>등록</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------
// Root with Tabs
// ---------------------------------
export default function App() {
  const [tab, setTab] = useState<TabKey>('log');
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastCategory, setLastCategory] = useState<string | null>(null);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F7FB" />
      <View style={styles.tabBar}>
        <TabButton label="기록" active={tab === 'log'} onPress={() => setTab('log')} />
        <TabButton label="피드백" active={tab === 'feedback'} onPress={() => setTab('feedback')} />
        <TabButton label="커뮤니티" active={tab === 'community'} onPress={() => setTab('community')} />
        {/* NEW */}
        <TabButton label="챗봇" active={tab === 'chat'} onPress={() => setTab('chat')} />
      </View>

      <View style={styles.divider} />

      {tab === 'log' && (
        <StressLogScreen
          onComputed={(s, c, m) => {
            setLastScore(s);
            setLastCategory(c);
            setLastMsg(m);
          }}
        />
      )}
      {tab === 'feedback' && <FeedbackScreen lastScore={lastScore} lastCategory={lastCategory} lastMsg={lastMsg} />}
      {tab === 'community' && <CommunityScreen />}
      {tab === 'chat' && <ChatScreen lastScore={lastScore} lastCategory={lastCategory} />}
    </SafeAreaView>
  );
}

const TabButton = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
  </TouchableOpacity>
);

// ---------------------------------
// Styles
// ---------------------------------
const styles = StyleSheet.create({
  // 베이스
  safe: { flex: 1, backgroundColor: '#F6F7FB' }, // 밝은 배경
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    backgroundColor: '#EDEFF7', // 연한 회청색
  },
  tabBtnActive: { backgroundColor: '#DDE6FF' }, // 활성 탭은 좀 더 밝게
  tabText: { color: '#51607A', fontWeight: '600', letterSpacing: 0.3 },
  tabTextActive: { color: '#1F2A44' }, // 더 진한 남청색
  divider: { height: 1, backgroundColor: '#E6EAF4', marginTop: 8 },

  // 공통 레이아웃/텍스트
  screenPad: { padding: 16 },
  title: { color: '#1F2A44', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  sectionTitle: { color: '#2A3B5F', fontSize: 15, fontWeight: '700' },

  // 입력 컴포넌트
  textArea: {
    minHeight: 110,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    color: '#1F2A44',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E6EAF4',
  },
  input: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    color: '#1F2A44',
    borderWidth: 1,
    borderColor: '#E6EAF4',
  },

  // 배열/정렬
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowJustify: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },

  // 칩
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  chipOn: { backgroundColor: '#E8EEFF', borderColor: '#D6E0FF' },
  chipOff: { backgroundColor: '#F3F6FD', borderColor: 'rgba(0,0,0,0.05)' },
  chipText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  chipTextOn: { color: '#2A3B5F' },
  chipTextOff: { color: '#51607A' },

  // 버튼
  primaryBtn: { marginTop: 18, backgroundColor: '#6C8EF5', paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryBtn: { marginTop: 18, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: '#EEF2FF' },
  secondaryBtnText: { color: '#2A3B5F', fontWeight: '700' },

  // 카드
  card: {
    marginTop: 16,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EAF4',
  },
  cardTitle: { color: '#1F2A44', fontWeight: '800', fontSize: 16 },
  cardSubtitle: { color: '#51607A', fontWeight: '700', fontSize: 13 },

  // 프로그레스 바
  progressWrap: {
    marginTop: 12,
    height: 22,
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E7ECF7',
    justifyContent: 'center',
  },
  progressBarBg: { ...StyleSheet.absoluteFillObject },
  progressBarFill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: '#6C8EF5' },
  progressText: { color: '#1F2A44', textAlign: 'center', fontWeight: '800', fontSize: 12 },

  // 배지/메시지
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    color: '#2A3B5F',
    fontWeight: '800',
    letterSpacing: 0.2,
    overflow: 'hidden',
  },
  resultMsg: { marginTop: 8, color: '#2A3B5F', lineHeight: 20 },
  guideText: { marginTop: 10, color: '#2A3B5F', fontWeight: '700' },
  link: { color: '#5C7CFA', fontWeight: '800' },

  // 커뮤니티
  postCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EAF4',
  },
  postMeta: { color: '#6B778C', fontSize: 12, marginBottom: 6 },
  postContent: { color: '#1F2A44', fontSize: 15, lineHeight: 22 },
  postBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#EEF2FF' },
  postBtnText: { color: '#2A3B5F', fontWeight: '700', fontSize: 13 },

  // 댓글
  commentRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  commentInput: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    color: '#1F2A44',
    borderWidth: 1,
    borderColor: '#E6EAF4',
  },
  commentSend: { paddingHorizontal: 12, height: 38, borderRadius: 12, justifyContent: 'center', backgroundColor: '#6C8EF5' },
  commentSendText: { color: '#FFFFFF', fontWeight: '800' },
  commentItem: { marginTop: 6, color: '#2A3B5F' },
  moreText: { marginTop: 6, color: '#6B778C', fontSize: 12 },

  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  modalCard: { padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E6EAF4' },
  modalTitle: { color: '#1F2A44', fontWeight: '800', fontSize: 16, marginBottom: 8 },
  modalItem: { color: '#2A3B5F', marginTop: 6 },

  // 피드백 화면 누락 스타일
  feedbackLine: { marginTop: 6, color: '#1F2A44', fontWeight: '700' },

  // 챗봇
  bubbleRow: { width: '100%', marginVertical: 4, flexDirection: 'row' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  bubbleBot: { backgroundColor: '#FFFFFF', borderColor: '#E6EAF4', borderBottomLeftRadius: 6 },
  bubbleUser: { backgroundColor: '#DDE6FF', borderColor: '#D0DBFF', borderBottomRightRadius: 6 },
  bubbleText: { color: '#1F2A44', lineHeight: 20 }, // 두 버블 모두 가독성 좋은 진한 텍스트

  chatInputRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    color: '#1F2A44',
    borderWidth: 1,
    borderColor: '#E6EAF4',
  },
  chatSendBtn: { height: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#6C8EF5', alignItems: 'center', justifyContent: 'center' },
  chatSendText: { color: '#FFFFFF', fontWeight: '800' },

  quickRow: { position: 'absolute', left: 0, right: 0, bottom: 60, paddingHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#DDE6FF' },
  quickChipText: { color: '#2A3B5F', fontSize: 12, fontWeight: '700' },
});
