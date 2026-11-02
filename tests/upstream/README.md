# Upstream regression harnesses

`module.cjs` and the tree, road-paint, pedestrian and driving regression harnesses in `../berlin-*.test.cjs` are adapted from [mrdoob/slop-newyork](https://github.com/mrdoob/slop-newyork/tree/343a0f91471dfd23ee24acabab22303420a733b7), copyright 2026 Mr.doob, under the [MIT license](LICENSE).

They execute production function bodies with small math/rendering stubs and compare observable behaviour, geometry and trajectories. Berlin adaptations cover distant-tree shadow suppression, existing pedestrian reactions/audio, the retained vehicle shader and normal/boost speeds. Browser shader compilation and visual checks supplement these CPU tests.
