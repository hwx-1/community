import React, {useMemo} from 'react';
import {FlatList, Pressable, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {Bell, ChevronRight, Search, Sparkles} from '../components/AliIcon';
import {useQuery} from '@tanstack/react-query';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api, formatTime} from '../api/client';
import type {RootStackParamList} from '../navigation/types';
import {useAuth} from '../auth/AuthContext';
import {PostCard} from '../components/PostCard';
import {ScreenState} from '../components/ScreenState';
import {radius, spacing, useAppTheme} from '../theme';

export function HomeScreen() {
  const theme = useAppTheme();
  const {account} = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const posts = useQuery({queryKey: ['posts'], queryFn: () => api.listPosts()});
  const announcements = useQuery({queryKey: ['announcements'], queryFn: api.listAnnouncements});
  const settings = useQuery({queryKey: ['public-settings'], queryFn: api.publicSettings});
  const refreshing = posts.isRefetching || announcements.isRefetching || settings.isRefetching;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }, []);

  const refresh = () => {
    void Promise.all([posts.refetch(), announcements.refetch(), settings.refetch()]);
  };

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['top']}>
      <View style={[styles.topBar, {backgroundColor: theme.colors.background}]}>
        <View style={styles.logoLine}>
          <View style={[styles.logo, {backgroundColor: theme.colors.primary}]}><Text style={styles.logoText}>x</Text></View>
          <Text style={[styles.wordmark, {color: theme.colors.text}]}>xsnbb</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="搜索帖子"
          onPress={() => navigation.navigate('Search')}
          style={({pressed}) => [styles.searchButton, {backgroundColor: theme.colors.surface, opacity: pressed ? 0.72 : 1}]}>
          <Search size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      <FlatList
        data={posts.data?.items ?? []}
        keyExtractor={item => String(item.id)}
        renderItem={({item}) => <PostCard post={item} onOpen={() => navigation.navigate('PostDetail', {postId: item.id})} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
        ListHeaderComponent={
          <View>
            <View style={styles.welcome}>
              <Text style={[styles.eyebrow, {color: theme.colors.primary}]}>SHENYANG UNIVERSITY COMMUNITY</Text>
              <Text style={[styles.title, {color: theme.colors.text}]}>{greeting}，{account?.nickname ?? '同学'}</Text>
              <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>看看校园里正在发生什么。</Text>
            </View>

            <View style={styles.infoRow}>
              <InfoCard
                icon={Bell}
                title="平台公告"
                detail={announcements.data?.items[0]?.title ?? '暂无新公告'}
                meta={announcements.data?.items[0] ? formatTime(announcements.data.items[0].created_at) : ''}
                onPress={() => navigation.navigate('Announcements')}
              />
              <InfoCard
                icon={Sparkles}
                title="热门话题"
                detail={(settings.data?.hot_topics ?? [])[0] ? `# ${(settings.data?.hot_topics ?? [])[0]}` : '运营推荐'
                }
                meta={`${settings.data?.hot_topics?.length ?? 0} 个话题`}
                onPress={() => navigation.navigate('Search')}
              />
            </View>

            <View style={styles.sectionHead}>
              <View>
                <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>最新动态</Text>
                <Text style={[styles.sectionMeta, {color: theme.colors.textSecondary}]}>按发布时间倒序</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          posts.isLoading
            ? <ScreenState loading />
            : posts.isError
              ? <ScreenState title="动态加载失败" message={(posts.error as Error).message} actionLabel="重新加载" onAction={() => void posts.refetch()} />
              : <ScreenState title="还没有帖子" message="发布第一条校园动态，和同学们打个招呼吧。" />
        }
        ListFooterComponent={(posts.data?.items.length ?? 0) > 0 ? <Text style={[styles.footer, {color: theme.colors.textSecondary}]}>已经看到这里了</Text> : undefined}
      />
    </SafeAreaView>
  );
}

function InfoCard({icon: Icon, title, detail, meta, onPress}: {icon: typeof Bell; title: string; detail: string; meta: string; onPress: () => void}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}，${detail}`}
      onPress={onPress}
      style={({pressed}) => [styles.infoCard, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.76 : 1}]}>
      <View style={[styles.infoIcon, {backgroundColor: theme.colors.primarySoft}]}><Icon size={19} color={theme.colors.primary} /></View>
      <View style={styles.infoBody}>
        <Text style={[styles.infoTitle, {color: theme.colors.text}]}>{title}</Text>
        <Text style={[styles.infoDetail, {color: theme.colors.textSecondary}]} numberOfLines={1}>{detail}</Text>
        <Text style={[styles.infoMeta, {color: theme.colors.textSecondary}]}>{meta}</Text>
      </View>
      <ChevronRight size={17} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  topBar: {height: 58, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  logoLine: {flexDirection: 'row', alignItems: 'center', gap: 9},
  logo: {width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  logoText: {fontSize: 23, lineHeight: 27, fontWeight: '900', color: '#FFFFFF'},
  wordmark: {fontSize: 20, fontWeight: '900', letterSpacing: -0.6},
  searchButton: {width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center'},
  listContent: {paddingBottom: 120},
  welcome: {paddingHorizontal: spacing.md, paddingTop: 18, paddingBottom: 20},
  eyebrow: {fontSize: 10, fontWeight: '800', letterSpacing: 1.25},
  title: {fontSize: 27, lineHeight: 35, fontWeight: '800', marginTop: 8, letterSpacing: -0.6},
  subtitle: {fontSize: 15, marginTop: 5},
  infoRow: {paddingHorizontal: spacing.md, flexDirection: 'row', gap: 10},
  infoCard: {flex: 1, minHeight: 126, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: 12},
  infoIcon: {width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  infoBody: {flex: 1, paddingTop: 8},
  infoTitle: {fontSize: 14, fontWeight: '800'},
  infoDetail: {fontSize: 12, marginTop: 4},
  infoMeta: {fontSize: 10, marginTop: 4},
  sectionHead: {paddingHorizontal: spacing.md, paddingTop: 28, paddingBottom: 12},
  sectionTitle: {fontSize: 21, fontWeight: '800'},
  sectionMeta: {fontSize: 12, marginTop: 3},
  footer: {textAlign: 'center', fontSize: 12, paddingTop: 16, paddingBottom: 40},
});
