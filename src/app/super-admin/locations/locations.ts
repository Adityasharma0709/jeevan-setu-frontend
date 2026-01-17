import { Component } from '@angular/core';
import { ApiService } from '../../core/services/api';
@Component({
 selector:'app-locations',
 templateUrl:'./locations.html'
})
export class LocationsComponent {

 locations:any[]=[];
 state='';

 constructor(private api:ApiService){}

 ngOnInit(){
  this.load();
 }

 load(){
  this.api.get('/locations')
   .subscribe(res=>this.locations=res as any[]);
 }

 create(){
  this.api.post('/locations',{state:this.state})
   .subscribe(()=>{
     this.state='';
     this.load();
   });
 }
}

