import React from 'react';
import {Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Bot, BusFront, CalendarDays, ChevronRight, ExternalLink, GraduationCap, Library, Link2, Map, PhoneCall, Sparkles, Wrench} from '../components/AliIcon';
import {useQuery} from '@tanstack/react-query';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api} from '../api/client';
import type {CampusTool} from '../api/types';
import type {RootStackParamList} from '../navigation/types';
import {ScreenState} from '../components/ScreenState';
import {radius, spacing, useAppTheme} from '../theme';

const icons = [Bot, Map, Link2, Library, CalendarDays, BusFront, PhoneCall, GraduationCap];

export function ToolsScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const query = useQuery({queryKey: ['tools'], queryFn: api.listTools});
  const tools = query.data?.items.filter(item => item.enabled) ?? [];

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, {color: theme.colors.primary}]}>CAMPUS TOOLBOX</Text>
        <Text style={[styles.title, {color: theme.colors.text}]}>校园百宝箱</Text>
        <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>办事、查询、问答，一个入口更省心。</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开校园 AI 助手"
          onPress={() => navigation.navigate('AI')}
          style={({pressed}) => [styles.hero, {backgroundColor: theme.colors.primary, opacity: pressed ? 0.82 : 1}]}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><Sparkles color="#FFFFFF" size={24} /></View>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>每日 10 次</Text></View>
          </View>
          <Text style={styles.heroTitle}>校园 AI 助手</Text>
          <Text style={styles.heroText}>查部门电话、校园通知和常见问题</Text>
          <View style={styles.heroAction}><Text style={styles.heroActionText}>开始提问</Text><ChevronRight size={18} color="#FFFFFF" /></View>
        </Pressable>

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>常用工具</Text>
          <Text style={[styles.sectionMeta, {color: theme.colors.textSecondary}]}>{tools.length} 项服务</Text>
        </View>

        {query.isLoading ? <ScreenState loading /> : query.isError ? (
          <ScreenState title="工具加载失败" message={(query.error as Error).message} actionLabel="重试" onAction={() => void query.refetch()} />
        ) : tools.length ? (
          <View style={styles.grid}>
            {tools.map((tool, index) => <ToolCard key={tool.id} tool={tool} index={index} />)}
          </View>
        ) : (
          <ScreenState title="工具正在准备中" message="管理员发布后会自动显示在这里。" />
        )}

        <View style={[styles.notice, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border}]}>
          <Wrench size={19} color={theme.colors.textSecondary} />
          <Text style={[styles.noticeText, {color: theme.colors.textSecondary}]}>外部链接会在系统浏览器中打开，请留意页面来源与隐私提示。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToolCard({tool, index}: {tool: CampusTool; index: number}) {
  const theme = useAppTheme();
  const Icon = icons[index % icons.length];
  const open = async () => {
    if (tool.url && await Linking.canOpenURL(tool.url)) {
      await Linking.openURL(tool.url);
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tool.name}
      accessibilityHint={tool.url ? '将在系统浏览器中打开' : '此工具暂未配置链接'}
      onPress={() => void open()}
      style={({pressed}) => [styles.tool, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.75 : 1}]}>
      <View style={[styles.toolIcon, {backgroundColor: theme.colors.primarySoft}]}><Icon size={23} color={theme.colors.primary} /></View>
      <Text style={[styles.toolName, {color: theme.colors.text}]} numberOfLines={2}>{tool.name}</Text>
      {tool.url ? <ExternalLink size={15} color={theme.colors.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  content: {paddingHorizontal: spacing.md, paddingTop: 24, paddingBottom: 120},
  eyebrow: {fontSize: 10, fontWeight: '800', letterSpacing: 1.25},
  title: {fontSize: 28, lineHeight: 36, fontWeight: '900', marginTop: 7},
  subtitle: {fontSize: 15, lineHeight: 22, marginTop: 4, marginBottom: 22},
  hero: {borderRadius: radius.lg, padding: 20, minHeight: 190},
  heroTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  heroIcon: {width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center'},
  heroBadge: {borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 6},
  heroBadgeText: {color: '#FFFFFF', fontSize: 11, fontWeight: '700'},
  heroTitle: {color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 18},
  heroText: {color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 5},
  heroAction: {minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: 14},
  heroActionText: {color: '#FFFFFF', fontWeight: '800'},
  sectionHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12},
  sectionTitle: {fontSize: 20, fontWeight: '800'},
  sectionMeta: {fontSize: 12},
  grid: {flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5},
  tool: {width: '47%', flexGrow: 1, minHeight: 130, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, margin: 5, padding: 14},
  toolIcon: {width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  toolName: {fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 12, marginBottom: 7},
  notice: {borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, marginTop: 22},
  noticeText: {flex: 1, fontSize: 12, lineHeight: 19},
});
