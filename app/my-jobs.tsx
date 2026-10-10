// app/my-jobs.tsx
import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, EyeOff, Trash2, Pause, Play, TrendingUp, Award, Clock, Image as ImageIcon, Star } from "lucide-react-native";
import { Stack, useRouter } from "expo-router";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AppHeader from "@/components/AppHeader"; // 🎯 НЭМСЭН: Бидний нэгдсэн толгой
import { isJobOwnedBy } from "@/lib/jobOwnership";
import { supabase } from '@/lib/supabase';
import { isListingExpired, manageListings } from '@/lib/listingLifecycle';

function formatTimeLeft(date: Date | null) {
  if (!date) return null;
  const now = new Date().getTime();
  const diff = date.getTime() - now;
  if (diff <= 0) return "Хугацаа дууссан";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / 1000 / 60) % 60);
  const secs = Math.floor((diff / 1000) % 60);

  return `${days} хоног ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDateToYMD(date: Date | null) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${d}, ${h}:${min}`;
}

export default function MyJobsScreen() {
  const router = useRouter();
  const { jobs, loadJobs } = useJobs() as any;
  const { user, refetchProfile } = useAuth() as any;
  const { colors } = useTheme();
  
  const [showInactive, setShowInactive] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [ownedJobs, setOwnedJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const selectMode = selected.length > 0;
  const reload = async () => {
    if (!user?.id) return;
    const {data,error} = await supabase.from('jobs').select('*').eq('posted_by_id',user.id).is('deleted_at',null).order('published_at',{ascending:false});
    if (error) throw error;
    setOwnedJobs(data ?? []);
    await Promise.allSettled([loadJobs(),refetchProfile?.()]);
  };
  useEffect(() => {
    if (!user?.id) { setOwnedJobs([]); return; }
    let current=true;
    supabase.from('jobs').select('*').eq('posted_by_id',user.id).is('deleted_at',null).order('published_at',{ascending:false})
      .then(({data,error}) => { if(current && !error) setOwnedJobs(data ?? []); });
    return () => {current=false;};
  },[user?.id,jobs]);
  const bulk = (action:'activate'|'deactivate'|'delete', ids=selected) => {
    const expired = ownedJobs.filter(j => ids.includes(j.id) && isListingExpired(j)).length;
    Alert.alert('Баталгаажуулах',`${ids.length} зарыг ${action==='activate'?'идэвхтэй болгох':action==='deactivate'?'идэвхгүй болгох':'устгах'} уу?${action==='activate' && expired ? `\nХугацаа дууссан ${expired} зарт ${expired} эрх хасагдана.` : ''}`,[
      {text:'Болих',style:'cancel'}, {text:'Үргэлжлүүлэх',style:action==='delete'?'destructive':'default',onPress:async()=>{
        if(loadingId) return;
        setLoadingId('bulk');
        try {await manageListings(ids,action);setSelected([]);await reload();}
        catch(e:any) {Alert.alert('Алдаа',e.message);}
        finally {setLoadingId(null);}
      }}]);
  };
  const pay = (type:'bump'|'sponsor',ids=selected) => {
    const invalid=ownedJobs.filter(j=>ids.includes(j.id) && (isListingExpired(j)||j.is_active===false||Number(j.available_quantity)<=0));
    if(invalid.length) {Alert.alert('Төлбөр үүсгэх боломжгүй',`${invalid.length} зар хугацаа дууссан, идэвхгүй эсвэл сул үлдэгдэлгүй байна. Эхлээд зарын төлөвөө шалгана уу.`);return;}
    router.push({pathname:'/sponsor-payment',params:{jobIds:ids.join(','),targetType:type}});
  };
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Таймер шинэчлэх
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const myJobs = useMemo(() => {
    if (!user) return [];
    let list = ownedJobs.filter((job: any) => isJobOwnedBy(job, user));
    
    if (!showInactive) {
      list = list.filter(j => j.is_active !== false && !isListingExpired(j,currentTime));
    }
    return list;
  }, [ownedJobs, user, showInactive,currentTime]);

  const handleDelete = (jobId: string) => {
    Alert.alert("Анхаар", "Та энэ зарыг устгахдаа итгэлтэй байна уу?", [
      { text: "Болих", style: "cancel" },
      { 
        text: "Устгах", 
        style: "destructive", 
        onPress: async () => {
          try {
            setLoadingId(jobId);
            await manageListings([jobId],'delete'); await reload();
          } catch (e:any) {
            Alert.alert("Алдаа", e.message);
          } finally {
            setLoadingId(null);
          }
        } 
      }
    ]);
  };

  const handleToggleActive = async (jobId: string, currentStatus: boolean) => {
    if (!currentStatus) { bulk('activate',[jobId]); return; }
    try {
      setLoadingId(jobId);
      await manageListings([jobId], 'deactivate'); await reload();
    } catch (e:any) {
      Alert.alert("Алдаа", e.message);
    } finally {
      setLoadingId(null);
    }
  };

  const getDaysAgoText = (date: Date | null) => {
    if (!date) return "";
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Өнөөдөр";
    if (days === 1) return "Өчигдөр";
    return `${days} хоногийн өмнө`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
      {/* 🎯 ЗАССАН: Expo-ийн үндсэн толгойг унтраасан */}
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* 🎯 ЗАССАН: Бидний шинээр хийсэн стандартын толгойг дуудсан */}
      <AppHeader title="Миний зарууд" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {myJobs.length > 0 && <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{checked:myJobs.every(j=>selected.includes(j.id)),disabled:!!loadingId}} style={{flexDirection:'row',alignItems:'center',gap:8,minHeight:44,alignSelf:'flex-start'}} disabled={!!loadingId} onPress={()=>setSelected(myJobs.every(j=>selected.includes(j.id))?[]:myJobs.map(j=>j.id))}>
          <Text style={{color:colors.text,fontSize:22}}>{myJobs.every(j=>selected.includes(j.id))?'☑':'☐'}</Text>
          <Text style={[styles.filterBtnText,{color:colors.text}]}>{myJobs.every(j=>selected.includes(j.id))?'Сонголт арилгах':'Бүгдийг сонгох'}</Text>
        </TouchableOpacity>}
        
        {/* Идэвхгүйг харуулах товч */}
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => {setShowInactive(!showInactive);setSelected([]);}} activeOpacity={0.7}>
          {showInactive ? <EyeOff size={18} color={colors.text} /> : <Eye size={18} color={colors.text} />}
          <Text style={[styles.filterBtnText, { color: colors.text }]}>{showInactive ? "Идэвхгүйг нуух" : "Идэвхгүйг харуулах"}</Text>
        </TouchableOpacity>

        {myJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Зар олдсонгүй</Text>
          </View>
        ) : (
          myJobs.map((job: any) => {
            const img = job.image_urls?.[0] || job.image_url;
            const imgCount = job.image_urls?.length || 0;
            const isActive = job.is_active !== false && !isListingExpired(job);
            const rating = job.itemRatingAvg || job.item_rating_avg || 0;
            const reviewCount = job.itemReviewCount || job.item_review_count || 0;
            const rentalCount = job.rentalCount || job.rental_count || 0;
            
            const isSponsored = job.isSponsored || job.is_sponsored;
            const sponsoredUntil = job.sponsoredUntil || job.sponsored_until ? new Date(job.sponsoredUntil || job.sponsored_until) : null;
            const isCurrentlySponsored = isSponsored && sponsoredUntil && sponsoredUntil.getTime() > Date.now();

            return (
              <View key={job.id} style={[styles.jobCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                
                {/* Толгой хэсэг */}
                <View style={styles.cardHeader}>
                  <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={`${job.title || job.category} зарыг сонгох`} accessibilityState={{checked:selected.includes(job.id),disabled:!!loadingId}} disabled={!!loadingId} onPress={()=>setSelected(prev=>prev.includes(job.id)?prev.filter(id=>id!==job.id):[...prev,job.id])} style={{padding:10}}><Text style={{color:colors.text,fontSize:22}}>{selected.includes(job.id)?'☑':'☐'}</Text></TouchableOpacity>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={2}>{job.title || job.category}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: isActive ? "rgba(16, 185, 129, 0.15)" : colors.backgroundSecondary }]}>
                    <Text style={[styles.statusText, { color: isActive ? "#059669" : colors.textSecondary }]}>{isActive ? "Идэвхтэй" : "Идэвхгүй"}</Text>
                  </View>
                </View>

                {job.subcategory && (
                  <View style={[styles.categoryPill, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={[styles.categoryPillText, { color: colors.textSecondary }]} numberOfLines={1}>{job.subcategory}</Text>
                  </View>
                )}

                <View style={styles.statsRow}>
                  <Star size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.statsText, { color: colors.textSecondary }]}>
                    {rating > 0 ? rating.toFixed(1) : "Шинэ эд зүйл"} · {reviewCount} үнэлгээ · {rentalCount} түрээс
                  </Text>
                </View>

                <Text style={[styles.descText, { color: colors.textSecondary }]} numberOfLines={2}>{job.description}</Text>

                {/* Зураг */}
                {imgCount > 0 && (
                  <View style={styles.imageSection}>
                    <View style={styles.imageCountWrap}>
                      <ImageIcon size={14} color={colors.textSecondary} />
                      <Text style={[styles.imageCountText, { color: colors.textSecondary }]}>{imgCount} зураг</Text>
                    </View>
                    <Image source={{ uri: img }} style={styles.thumbnail} contentFit="cover" />
                  </View>
                )}

                <View style={styles.timeWrap}>
                  <Clock size={14} color={colors.textSecondary} />
                  <Text style={[styles.timeText, { color: colors.textSecondary }]}>{getDaysAgoText(new Date(job.published_at ?? job.created_at))} · {isListingExpired(job)?'Хугацаа дууссан':`Дуусах: ${formatDateToYMD(new Date(job.listing_expires_at))}`}</Text>
                </View>

                {/* Үйлдлийн товчнууд (Устгах, Идэвхгүй) */}
                {!selectMode && <>
                <View style={styles.actionsGrid}>
                  <TouchableOpacity style={[styles.halfBtn, { borderColor: colors.border }]} onPress={() => handleDelete(job.id)} disabled={loadingId === job.id}>
                    <Trash2 size={16} color={colors.text} />
                    <Text style={[styles.halfBtnText, { color: colors.text }]}>Устгах</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.halfBtn, { borderColor: colors.border }]} onPress={() => handleToggleActive(job.id, isActive)} disabled={loadingId === job.id}>
                    {loadingId === job.id ? <ActivityIndicator size="small" /> : (isActive ? <Pause size={16} color={colors.text} /> : <Play size={16} color={colors.text} />)}
                    <Text style={[styles.halfBtnText, { color: colors.text }]}>{isActive ? "Идэвхгүй" : "Идэвхтэй"}</Text>
                  </TouchableOpacity>
                </View>

                {/* 🎯 BUMP ТОВЧ (QPay рүү үсэрнэ) */}
                <TouchableOpacity 
                  style={[styles.fullBtn, { borderColor: colors.border }]} 
                  onPress={() => pay('bump',[job.id])}
                  activeOpacity={0.7}
                >
                  <TrendingUp size={16} color={colors.text} />
                  <Text style={[styles.fullBtnText, { color: colors.text }]}>Зараа дээш гаргах (1,000₮)</Text>
                </TouchableOpacity>

                {/* SPONSOR ХЭСЭГ */}
                {isCurrentlySponsored ? (
                  <View style={[styles.sponsoredBox, { backgroundColor: "rgba(109, 40, 217, 0.05)", borderColor: "#6D28D9" }]}>
                    <View style={[styles.sponsoredBtn, { backgroundColor: "#6D28D9" }]}>
                      <Award size={16} color="#fff" />
                      <Text style={[styles.sponsoredBtnText, { color: "#fff" }]}>Sponsored зар</Text>
                    </View>
                    <Text style={[styles.sponsoredTimer, { color: colors.text }]}>Үлдсэн: {formatTimeLeft(sponsoredUntil)}</Text>
                    <Text style={[styles.sponsoredEnd, { color: colors.textSecondary }]}>Дуусах: {formatDateToYMD(sponsoredUntil)}</Text>
                    <Text style={[styles.sponsoredEnd, { color: colors.textSecondary, marginTop: 6 }]}>Үзэлт: {Number(job.sponsored_view_count ?? 0).toLocaleString()} · Даралт: {Number(job.sponsored_click_count ?? 0).toLocaleString()}</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={[styles.fullBtn, { backgroundColor: "#6D28D9", borderColor: "#6D28D9" }]} 
                    onPress={() => pay('sponsor',[job.id])}
                    activeOpacity={0.8}
                  >
                    <Award size={16} color="#fff" />
                    <Text style={[styles.fullBtnText, { color: "#fff" }]}>Sponsored зар</Text>
                  </TouchableOpacity>
                )}
                </>}

              </View>
            );
          })
        )}
      </ScrollView>
      {selectMode && <View testID="bulk-action-bar" style={[styles.bulkBar,{backgroundColor:colors.background,borderColor:colors.border}]}>
        <View style={styles.bulkHeading}>
          <Text accessibilityLiveRegion="polite" style={[styles.bulkCount,{color:colors.text}]}>{selected.length} зар сонгосон</Text>
          {loadingId ? <ActivityIndicator color="#6D28D9" /> : <TouchableOpacity accessibilityRole="button" onPress={()=>setSelected([])} style={styles.bulkCancel}><Text style={{color:colors.text,fontWeight:'600'}}>Болих</Text></TouchableOpacity>}
        </View>
        {selected.length===0 ? <Text style={{color:colors.textSecondary}}>Үйлдэл хийх заруудаа чагтлаарай.</Text> : <>
          <View style={styles.bulkRow}>
            <TouchableOpacity accessibilityRole="button" disabled={!!loadingId} onPress={()=>pay('bump')} style={[styles.bulkButton,styles.bulkPrimary,loadingId&&styles.bulkDisabled]}>
              <TrendingUp size={18} color="#fff" /><Text style={styles.bulkPrimaryText}>Pump · {(selected.length*1000).toLocaleString()}₮</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={!!loadingId} onPress={()=>pay('sponsor')} style={[styles.bulkButton,styles.bulkPrimary,loadingId&&styles.bulkDisabled]}>
              <Award size={18} color="#fff" /><Text style={styles.bulkPrimaryText}>Sponsored</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bulkRow}>
            <TouchableOpacity accessibilityRole="button" disabled={!!loadingId} onPress={()=>bulk('activate')} style={[styles.bulkButton,{borderColor:colors.border},loadingId&&styles.bulkDisabled]}>
              <Play size={16} color={colors.text}/><Text style={[styles.bulkText,{color:colors.text}]}>Идэвхтэй{ '\n' }болгох</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={!!loadingId} onPress={()=>bulk('deactivate')} style={[styles.bulkButton,{borderColor:colors.border},loadingId&&styles.bulkDisabled]}>
              <Pause size={16} color={colors.text}/><Text style={[styles.bulkText,{color:colors.text}]}>Идэвхгүй{ '\n' }болгох</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={!!loadingId} onPress={()=>bulk('delete')} style={[styles.bulkButton,{borderColor:'#EF4444',backgroundColor:'rgba(239,68,68,0.06)'},loadingId&&styles.bulkDisabled]}>
              <Trash2 size={16} color="#EF4444"/><Text style={[styles.bulkText,{color:'#EF4444'}]}>Устгах</Text>
            </TouchableOpacity>
          </View>
        </>}
      </View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bulkBar: {padding:12,gap:10,borderTopWidth:1,shadowColor:'#000',shadowOffset:{width:0,height:-2},shadowOpacity:0.08,shadowRadius:8,elevation:8},
  bulkHeading: {flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  bulkCount: {fontSize:16,fontWeight:'700'},
  bulkCancel: {paddingHorizontal:12,paddingVertical:10,minHeight:44,justifyContent:'center'},
  bulkRow: {flexDirection:'row',gap:8},
  bulkButton: {flex:1,minHeight:52,paddingVertical:10,paddingHorizontal:6,borderWidth:1,borderRadius:12,alignItems:'center',justifyContent:'center',gap:5},
  bulkPrimary: {backgroundColor:'#6D28D9',borderColor:'#6D28D9'},
  bulkPrimaryText: {color:'#fff',fontWeight:'700',fontSize:14,textAlign:'center'},
  bulkText: {fontSize:12,fontWeight:'600',textAlign:'center'},
  bulkDisabled: {opacity:0.5},
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40, gap: 16 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  filterBtnText: { fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 15 },
  
  jobCard: { borderRadius: 16, padding: 16, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  jobTitle: { fontSize: 18, fontWeight: '800' },
  categoryPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  categoryPillText: { fontSize: 12, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statsText: { fontSize: 13, fontWeight: '600' },
  descText: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  
  imageSection: { marginBottom: 14 },
  imageCountWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  imageCountText: { fontSize: 13 },
  thumbnail: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#EAEAEA' },
  
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  timeText: { fontSize: 13 },
  
  actionsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  halfBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderWidth: 1, borderRadius: 12, gap: 8 },
  halfBtnText: { fontSize: 14, fontWeight: '600' },
  
  fullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderWidth: 1, borderRadius: 12, gap: 8, marginBottom: 10 },
  fullBtnText: { fontSize: 14, fontWeight: '700' },

  sponsoredBox: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  sponsoredBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, width: '100%', gap: 8, marginBottom: 12 },
  sponsoredBtnText: { fontSize: 15, fontWeight: '700' },
  sponsoredTimer: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sponsoredEnd: { fontSize: 12 },
});
