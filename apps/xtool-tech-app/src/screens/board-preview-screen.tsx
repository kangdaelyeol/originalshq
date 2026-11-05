import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { signOutXtool } from '@xtool-core/auth';
import { useCurrentMember } from '@xtool-core/member-context';
import { useTechBoard } from '@xtool-core/tech-boards-store';

/**
 * 보드 미리보기 — 공용 코드(useTechBoard)로 AS 보드를 실시간으로 읽어 그룹·이름만 늘어놓는다. 앱 연결을
 * 확인하는 자리라, 실제 화면은 정해지는 대로 바꾼다.
 */
export function BoardPreviewScreen() {
  const member = useCurrentMember();
  const { meta, items, error } = useTechBoard('repair');
  const groupTitle = useMemo(() => new Map(meta?.groups.map(g => [g.id, g.title]) ?? []), [meta]);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>{meta?.name ?? 'AS'}</Text>
          <Text style={styles.sub}>
            {member?.name || member?.email} · {items ? `${items.length}건` : '불러오는 중'}
          </Text>
        </View>
        <Pressable onPress={signOutXtool} hitSlop={8}>
          <Text style={styles.link}>로그아웃</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {!items && !error ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={item => item.localKey ?? item.itemId}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.stage}>{(item.groupId && groupTitle.get(item.groupId)) || '—'}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#c3c6d4',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#323338' },
  sub: { marginTop: 2, fontSize: 13, color: '#676879' },
  link: { color: '#0073ea', fontSize: 14 },
  error: { margin: 16, color: '#d83a52' },
  loading: { marginTop: 32 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6e9ef',
  },
  name: { flex: 1, fontSize: 15, color: '#323338' },
  stage: { fontSize: 13, color: '#676879' },
});
