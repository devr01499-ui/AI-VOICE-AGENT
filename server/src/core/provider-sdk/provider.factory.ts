import { IRealtimeProviderSDK } from './provider.interface';
import { GeminiProvider } from '../providers/gemini/GeminiProvider';

export class ProviderFactory {
  static create(name: string): IRealtimeProviderSDK {
    const normalized = name.toLowerCase();
    if (normalized === 'gemini' || normalized === 'gemini-live') {
      return new GeminiProvider();
    }
    throw new Error(`ProviderFactory: Unknown provider type '${name}'`);
  }
}
