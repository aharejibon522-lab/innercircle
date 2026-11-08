import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { io, Socket } from "socket.io-client";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "https://innercircle-backend-mb2i.onrender.com";
const gold = "#D7B56D";
const missions = ["Make someone laugh without speaking","Get another player to say your name","Convince the group to take a selfie","Give someone a sincere compliment","Get two players to high-five"];

type Player = { id:string; name:string; score:number; connected?:boolean };
type Room = { code:string; players:Player[]; hostId:string; status:string };
export default function App() {
  const [socket,setSocket] = useState<Socket|null>(null);
  const [name,setName] = useState("");
  const [code,setCode] = useState("");
  const [room,setRoom] = useState<Room|null>(null);
  const [mission,setMission] = useState("");
  const [dare,setDare] = useState("");
  const [busy,setBusy] = useState(false);
  const [connected,setConnected] = useState(false);
  useEffect(()=> {
    const s=io(SERVER_URL,{transports:["websocket"],timeout:8000});
    setSocket(s);
    s.on("connect",()=>setConnected(true));
    s.on("disconnect",()=>setConnected(false));
    s.on("room:update",(r:Room)=>setRoom(r));
    s.on("room:error",(m:string)=>Alert.alert("The Circle",m));
    s.on("game:mission",(m:string)=>setMission(m));
    s.on("game:dare",({dare}:{dare:string})=>setDare(dare));
    return ()=>{s.disconnect();};
  },[]);
  const playerId = socket?.id;
  const sorted = useMemo(()=>[...(room?.players||[])].sort((a,b)=>b.score-a.score),[room]);
  const createRoom=()=>{if(!name.trim()||!socket)return;setBusy(true);socket.emit("room:create",{name:name.trim()},()=>setBusy(false));};
  const joinRoom=()=>{if(!name.trim()||!code.trim()||!socket)return;setBusy(true);socket.emit("room:join",{name:name.trim(),code:code.trim().toUpperCase()},()=>setBusy(false));};
  const leave=()=>{socket?.emit("room:leave");setRoom(null);setMission("");};
  const spin=()=>socket?.emit("game:dare-spin");
  const completeMission=()=>{if(mission&&socket){socket.emit("game:mission-complete",{mission});setMission("");}};
  return <SafeAreaView style={styles.safe}><StatusBar style="light"/><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.top}><View style={styles.mark}><Text style={styles.markText}>IC</Text></View><View style={{flex:1}}><Text style={styles.eyebrow}>THE PRIVATE PARTY GAME</Text><Text style={styles.brand}>INNER CIRCLE</Text></View><View style={[styles.dot,{backgroundColor:connected?"#69C99B":"#D36B6B"}]}/></View>
    {!room ? <><View style={styles.hero}><Text style={styles.kicker}>GOOD FRIENDS. BAD IDEAS. GREAT STORIES.</Text><Text style={styles.heading}>Your circle.{ "\n" }Your rules.</Text><Text style={styles.sub}>A little mystery makes every night unforgettable.</Text></View>
      <View style={styles.panel}><Text style={styles.label}>YOUR PLAYER NAME</Text><TextInput value={name} onChangeText={setName} placeholder="What should we call you?" placeholderTextColor="#777783" style={styles.input} maxLength={18}/><Pressable disabled={!name.trim()||busy} onPress={createRoom} style={[styles.primary,(!name.trim()||busy)&&styles.disabled]}><Text style={styles.primaryText}>CREATE A PRIVATE ROOM  ↗</Text></Pressable><View style={styles.or}><View style={styles.line}/><Text style={styles.muted}>OR JOIN YOUR FRIENDS</Text><View style={styles.line}/></View><TextInput value={code} onChangeText={setCode} placeholder="ENTER ROOM CODE" placeholderTextColor="#777783" autoCapitalize="characters" style={[styles.input,styles.codeInput]}/><Pressable disabled={!name.trim()||!code.trim()||busy} onPress={joinRoom} style={styles.secondary}><Text style={styles.secondaryText}>JOIN THE CIRCLE</Text></Pressable></View>
      <Text style={styles.footer}>PRIVATE ROOMS  ·  SECRET MISSIONS  ·  NO AWKWARD NIGHTS</Text>
    </> : <><View style={styles.roomHead}><Text style={styles.kicker}>YOUR PRIVATE ROOM</Text><Text style={styles.heading}>You're in.</Text><Text style={styles.sub}>Share this code with your people.</Text><View style={styles.codeBox}><Text style={styles.roomCode}>{room.code}</Text><Pressable onPress={()=>Alert.alert("Room code",room.code)}><Text style={styles.copy}>ROOM CODE</Text></Pressable></View></View>
      <View style={styles.panel}><View style={styles.sectionRow}><Text style={styles.sectionTitle}>THE PLAYERS</Text><Text style={styles.count}>{room.players.length} IN THE CIRCLE</Text></View>{sorted.map((p,i)=><View key={p.id} style={styles.player}><Text style={styles.rank}>{String(i+1).padStart(2,"0")}</Text><View style={{flex:1}}><Text style={styles.playerName}>{p.name}{p.id===room.hostId?"  ✦":""}</Text><Text style={styles.playerStatus}>{p.connected===false?"RECONNECTING":"IN THE ROOM"}</Text></View><Text style={styles.score}>{p.score} <Text style={styles.pts}>PTS</Text></Text></View>)}</View>
      <View style={styles.panel}><Text style={styles.sectionTitle}>SECRET MISSION</Text><Text style={styles.sub}>Complete a mission without revealing it.</Text>{mission?<><Text style={styles.mission}>{mission}</Text><Pressable onPress={completeMission} style={styles.primary}><Text style={styles.primaryText}>MISSION COMPLETE  +10</Text></Pressable></>:<Pressable onPress={()=>socket?.emit("game:mission-request")} style={styles.secondary}><Text style={styles.secondaryText}>RECEIVE A SECRET MISSION</Text></Pressable>}</View>
      <View style={styles.panel}><Text style={styles.sectionTitle}>DARE WHEEL</Text><Text style={styles.sub}>Fortune favours the bold.</Text><View style={styles.dareCircle}><Text style={styles.dareEmoji}>✦</Text><Text style={styles.dareText}>{dare||"READY TO RISK IT?"}</Text></View><Pressable onPress={spin} style={styles.primary}><Text style={styles.primaryText}>SPIN THE WHEEL</Text></Pressable></View>
      <Pressable onPress={leave} style={styles.leave}><Text style={styles.leaveText}>LEAVE ROOM</Text></Pressable>
    </>}
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:"#09090D"},page:{padding:22,paddingBottom:44},top:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:34},mark:{width:42,height:42,borderRadius:14,borderWidth:1,borderColor:gold,alignItems:"center",justifyContent:"center"},markText:{color:gold,fontSize:16,fontWeight:"900",letterSpacing:1},eyebrow:{color:"#8F8D98",fontSize:9,letterSpacing:2,fontWeight:"700"},brand:{color:"#F4F0E8",fontSize:15,fontWeight:"900",letterSpacing:2,marginTop:3},dot:{width:8,height:8,borderRadius:8},hero:{paddingVertical:28},kicker:{color:gold,fontSize:10,letterSpacing:2.2,fontWeight:"800"},heading:{color:"#F6F1E8",fontSize:46,fontWeight:"800",letterSpacing:-1.5,lineHeight:52,marginTop:15},sub:{color:"#9B99A4",fontSize:14,lineHeight:22,marginTop:10},panel:{backgroundColor:"#14141B",borderColor:"#292832",borderWidth:1,borderRadius:20,padding:20,marginTop:18},label:{color:"#B7B2A6",fontSize:10,fontWeight:"800",letterSpacing:1.7,marginBottom:10},input:{backgroundColor:"#0C0C12",borderColor:"#302E38",borderWidth:1,borderRadius:12,color:"#F6F1E8",paddingHorizontal:15,paddingVertical:15,fontSize:14},primary:{backgroundColor:gold,borderRadius:12,padding:16,alignItems:"center",marginTop:14},primaryText:{color:"#17130C",fontSize:11,fontWeight:"900",letterSpacing:1.3},disabled:{opacity:.45},or:{flexDirection:"row",alignItems:"center",gap:10,marginVertical:20},line:{height:1,backgroundColor:"#302E38",flex:1},muted:{color:"#777581",fontSize:9,letterSpacing:1.2,fontWeight:"700"},codeInput:{textAlign:"center",letterSpacing:4,fontWeight:"800"},secondary:{borderWidth:1,borderColor:gold,borderRadius:12,padding:15,alignItems:"center",marginTop:12},secondaryText:{color:gold,fontSize:11,fontWeight:"900",letterSpacing:1.4},footer:{color:"#65636D",fontSize:8,letterSpacing:1.4,textAlign:"center",marginTop:25,lineHeight:18},roomHead:{paddingVertical:10},codeBox:{marginTop:22,backgroundColor:"#17161E",borderRadius:16,borderWidth:1,borderColor:"#51442B",padding:20,alignItems:"center"},roomCode:{color:gold,fontSize:34,fontWeight:"900",letterSpacing:8},copy:{color:"#9A927F",fontSize:9,letterSpacing:2,marginTop:8},sectionRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12},sectionTitle:{color:"#F4F0E8",fontSize:12,fontWeight:"900",letterSpacing:1.8},count:{color:gold,fontSize:9,letterSpacing:1},player:{flexDirection:"row",alignItems:"center",paddingVertical:13,borderTopWidth:1,borderTopColor:"#292832",gap:13},rank:{color:"#777581",fontSize:12,fontWeight:"700",width:22},playerName:{color:"#F2EEE7",fontSize:14,fontWeight:"700"},playerStatus:{color:"#777581",fontSize:8,letterSpacing:1.1,marginTop:4},score:{color:gold,fontSize:16,fontWeight:"800"},pts:{color:"#777581",fontSize:8},mission:{color:"#F1D9A4",fontSize:18,fontWeight:"700",lineHeight:27,marginTop:20},dareCircle:{minHeight:145,borderRadius:18,borderWidth:1,borderColor:"#51442B",backgroundColor:"#1B1920",alignItems:"center",justifyContent:"center",padding:20,marginTop:18},dareEmoji:{color:gold,fontSize:24,marginBottom:12},dareText:{color:"#F4E7CA",fontSize:16,fontWeight:"800",textAlign:"center",lineHeight:24},leave:{alignItems:"center",padding:18},leaveText:{color:"#9A6870",fontSize:10,letterSpacing:2,fontWeight:"800"}});
