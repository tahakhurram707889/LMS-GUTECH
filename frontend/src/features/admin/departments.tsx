import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Collection } from '../../components/ui/collection';
import { Modal } from '../../components/ui/modal';
import { Form } from '../../components/ui/forms';
import { Button } from '../../components/ui/button';
import { mutate } from '../../lib/api';
type Department={id:string;code:string;name:string};
export function DepartmentsPage(){
  const cache=useQueryClient();const [editing,setEditing]=useState<Department|null|undefined>();const [search,setSearch]=useState('');
  return <><div className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>Academic departments</h1><p>Organize courses into departments. Existing courses can remain unassigned.</p></div><Button onClick={()=>setEditing(null)}>Create department</Button></div>
    <div className="list-toolbar"><label>Search departments<input value={search} onChange={(e)=>setSearch(e.target.value)}/></label></div>
    <Collection<Department> path={`/admin/departments?search=${encodeURIComponent(search)}`}>{(rows)=><div className="table-scroll"><table><thead><tr><th>Code</th><th>Name</th><th>Actions</th></tr></thead><tbody>{rows.map((d)=><tr key={d.id}><td>{d.code}</td><td>{d.name}</td><td><Button variant="ghost" onClick={()=>setEditing(d)}>Edit</Button></td></tr>)}</tbody></table></div>}</Collection>
    {editing!==undefined&&<Modal title={editing?'Edit department':'Create department'} onClose={()=>setEditing(undefined)}><Form fields={[{name:'code',label:'Department code'},{name:'name',label:'Department name'}]} initial={editing?{code:editing.code,name:editing.name}:{}} onSubmit={async(values)=>{await mutate(editing?`/admin/departments/${editing.id}`:'/admin/departments',values,editing?'PATCH':'POST');setEditing(undefined);await cache.invalidateQueries();}}/></Modal>}
  </>;
}
