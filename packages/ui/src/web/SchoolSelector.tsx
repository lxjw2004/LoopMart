"use client";
import {useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Dialog,DialogHeader} from '@astryxdesign/core/Dialog';
import {VStack} from '@astryxdesign/core/VStack';
import {TextInput} from '@astryxdesign/core/TextInput';
import {List,ListItem} from '@astryxdesign/core/List';
import {Icon} from '@astryxdesign/core/Icon';
import {Text} from '@astryxdesign/core/Text';
import {matchesSchool,schools} from '../schools';
export default function SchoolSelector({english,selection,onSelect}:{english:boolean;selection?:typeof schools[number];onSelect?:(school:typeof schools[number])=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 const [localSelection,setLocalSelection]=useState(schools[0]);
 const selected=selection||localSelection;
 const setSelected=onSelect||setLocalSelection;
 const say=(zh:string,en:string)=>english?en:zh;
 const results=schools.filter(school=>matchesSchool(school,query));
 return <>
  <Button className="school-trigger" variant="ghost" label={say('选择学校','Select university')+': '+selected.name} aria-label={say('选择学校','Select university')+': '+selected.name} aria-haspopup="dialog" onClick={()=>{setQuery('');setOpen(true)}} endContent={<Icon icon="chevronDown"/>}><Text as="span" type="inherit" style={{display:'var(--lm-mobile-display)'}}>{selected.shortName}</Text><Text as="span" type="inherit" style={{display:'var(--lm-nonmobile-display)'}}>{selected.name}</Text></Button>
  <Dialog isOpen={open} onOpenChange={setOpen} width="calc(var(--spacing-12) * 10)" aria-label={say('选择学校','Select university')}>
   <VStack gap={4}><DialogHeader title={say('选择学校','Select university')} onOpenChange={setOpen}/><TextInput hasAutoFocus type="search" label={say('搜索学校','Search universities')} isLabelHidden placeholder={say('搜索学校','Search universities')} value={query} onChange={setQuery}/>
    <List>{results.map(school=><ListItem key={school.id} label={school.name} isSelected={selected.id===school.id} endContent={selected.id===school.id?<Icon icon="check"/>:undefined} onClick={()=>{setSelected(school);setOpen(false)}}/>)}</List>
    {!results.length&&<Text role="status" type="supporting">{say('未找到学校','No universities found')}</Text>}
   </VStack>
  </Dialog>
 </>;
}
