import { beforeEach, describe, expect, it } from "vitest";
import { emptyProfile, useWorkshop } from "./workshop";

describe("workshop history", () => {
  beforeEach(() => {
    useWorkshop.setState({
      profile: emptyProfile(),
      past: [],
      future: [],
      gameData: {}
    });
  });

  it("undoes, redoes and keeps at most 50 snapshots", () => {
    for (let index = 0; index < 55; index += 1) {
      useWorkshop.getState().editProfile((profile) => {
        profile.name = `Profil ${index}`;
      });
    }

    expect(useWorkshop.getState().past).toHaveLength(50);
    expect(useWorkshop.getState().profile?.name).toBe("Profil 54");

    useWorkshop.getState().undo();
    expect(useWorkshop.getState().profile?.name).toBe("Profil 53");

    useWorkshop.getState().redo();
    expect(useWorkshop.getState().profile?.name).toBe("Profil 54");
  });
});
