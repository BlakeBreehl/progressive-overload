import { Component, type ReactNode } from 'react';
import { safeSupabaseDiagnostic } from '../lib/supabaseError';
export class FeatureBoundary extends Component<{children:ReactNode},{failed:boolean;attempt:number}> {
  state={failed:false,attempt:0};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error){safeSupabaseDiagnostic('Application','render feature',error);}
  render(){return this.state.failed?<section className="surface-card" role="alert"><h1 className="font-bold text-ink">This screen could not load.</h1><p className="mt-2">Check your connection and retry. You can still use navigation.</p><button className="primary-button mt-4" onClick={()=>this.setState(state=>({failed:false,attempt:state.attempt+1}))}>Retry</button></section>:<div key={this.state.attempt}>{this.props.children}</div>;}
}
