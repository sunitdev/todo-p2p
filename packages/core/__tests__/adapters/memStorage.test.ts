import { MemStorage } from "../helpers/MemStorage.ts";
import { storageAdapterContract } from "./contract.ts";

storageAdapterContract("MemStorage", async () => new MemStorage());
